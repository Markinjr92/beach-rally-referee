import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Trophy } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sem horário definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem horário definido'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

const formatDate = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)
}

type Tournament = Tables<'tournaments'>
type Match = Tables<'matches'>
type Team = Tables<'teams'>
type MatchScore = Tables<'match_scores'>

type MatchWithTeams = Match & {
  teamA?: Team | null
  teamB?: Team | null
}

const TournamentInfoDetail = () => {
  const { tournamentId } = useParams()
  const { toast } = useToast()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [scoresByMatch, setScoresByMatch] = useState<Record<string, MatchScore[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) return
      setLoading(true)

      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single()

      if (tournamentError) {
        toast({
          title: 'Não foi possível carregar o torneio',
          description: tournamentError.message,
          variant: 'destructive',
        })
        setTournament(null)
        setMatches([])
        setScoresByMatch({})
        setLoading(false)
        return
      }

      setTournament(tournamentData)

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('scheduled_at', { ascending: true })

      if (matchError) {
        toast({
          title: 'Não foi possível carregar os jogos',
          description: matchError.message,
          variant: 'destructive',
        })
        setMatches([])
        setScoresByMatch({})
        setLoading(false)
        return
      }

      const teamIds = Array.from(
        new Set([
          ...(matchData?.map((match) => match.team_a_id) || []),
          ...(matchData?.map((match) => match.team_b_id) || []),
        ])
      )

      let teamMap = new Map<string, Team>()
      if (teamIds.length > 0) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds)

        if (teamError) {
          toast({
            title: 'Não foi possível carregar as equipes',
            description: teamError.message,
            variant: 'destructive',
          })
        } else {
          teamMap = new Map(teamData?.map((team) => [team.id, team]) || [])
        }
      }

      const enrichedMatches: MatchWithTeams[] = (matchData || []).map((match) => ({
        ...match,
        teamA: teamMap.get(match.team_a_id),
        teamB: teamMap.get(match.team_b_id),
      }))

      setMatches(enrichedMatches)

      if ((matchData?.length || 0) > 0) {
        const { data: scoreData, error: scoreError } = await supabase
          .from('match_scores')
          .select('*')
          .in('match_id', matchData!.map((match) => match.id))
          .order('set_number', { ascending: true })

        if (scoreError) {
          toast({
            title: 'Não foi possível carregar os placares',
            description: scoreError.message,
            variant: 'destructive',
          })
          setScoresByMatch({})
        } else {
          const grouped = scoreData?.reduce<Record<string, MatchScore[]>>((acc, score) => {
            acc[score.match_id] = acc[score.match_id] || []
            acc[score.match_id].push(score)
            return acc
          }, {}) || {}
          setScoresByMatch(grouped)
        }
      } else {
        setScoresByMatch({})
      }

      setLoading(false)
    }

    load()
  }, [tournamentId, toast])

  const upcomingMatches = useMemo(
    () => matches.filter((match) => match.status !== 'completed' && match.status !== 'canceled'),
    [matches]
  )
  const completedMatches = useMemo(
    () => matches.filter((match) => match.status === 'completed'),
    [matches]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        <div className="text-lg text-white/80">Carregando informações do torneio...</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-white/80">Torneio não encontrado.</p>
          <Button asChild className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
            <Link to="/tournament-info">Voltar para os torneios</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/tournament-info" className="w-fit">
            <Button
              variant="ghost"
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="text-right md:text-left md:flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 mb-3">
              <Trophy className="text-yellow-300" size={18} />
              <span className="uppercase tracking-[0.2em] text-xs text-white/70">Informações do torneio</span>
            </div>
            <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
            <div className="mt-3 flex flex-wrap justify-end md:justify-start gap-3 text-sm text-white/80">
              <span className="flex items-center gap-2">
                <MapPin size={16} className="text-white/60" />
                {tournament.location || 'Local a definir'}
              </span>
              <span className="flex items-center gap-2">
                <Calendar size={16} className="text-white/60" />
                {formatDate(tournament.start_date)}
                <span className="text-white/50">até</span>
                {formatDate(tournament.end_date)}
              </span>
              {tournament.category && (
                <Badge variant="outline" className="border-white/30 text-white">
                  Categoria: {tournament.category}
                </Badge>
              )}
              {tournament.modality && (
                <Badge variant="outline" className="border-white/30 text-white">
                  Modalidade: {tournament.modality}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-xl">Informações gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/80">
            <div>
              <span className="font-semibold text-white">Local:</span> {tournament.location || 'Não informado'}
            </div>
            <div>
              <span className="font-semibold text-white">Período:</span> {formatDate(tournament.start_date)}
              <span className="text-white/50"> até </span>
              {formatDate(tournament.end_date)}
            </div>
            <div>
              <span className="font-semibold text-white">Categoria:</span> {tournament.category || 'Não informado'}
            </div>
            <div>
              <span className="font-semibold text-white">Modalidade:</span> {tournament.modality || 'Não informado'}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl">Próximos jogos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingMatches.length === 0 ? (
                <p className="text-sm text-white/70">Nenhum jogo agendado ou em andamento.</p>
              ) : (
                upcomingMatches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-lg border border-white/15 bg-white/5 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-white/60" />
                        {formatDateTime(match.scheduled_at)}
                      </div>
                      <Badge variant="outline" className="border-white/30 text-white uppercase">
                        {match.status === 'in_progress' ? 'Em andamento' : 'Agendado'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-white">
                      <div className="text-base font-semibold">{match.teamA?.name || 'Equipe A'}</div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/50">vs</div>
                      <div className="text-base font-semibold">{match.teamB?.name || 'Equipe B'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
                      >
                        <Link to={`/scoreboard/${match.id}`}>Placar ao vivo</Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
                      >
                        <Link to={`/spectator/${match.id}`}>Visão da torcida</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl">Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {completedMatches.length === 0 ? (
                <p className="text-sm text-white/70">Nenhum resultado registrado ainda.</p>
              ) : (
                completedMatches.map((match) => {
                  const scores = scoresByMatch[match.id] || []
                  const setTotals = scores.reduce(
                    (acc, score) => {
                      if (score.team_a_points > score.team_b_points) acc.teamA += 1
                      if (score.team_b_points > score.team_a_points) acc.teamB += 1
                      return acc
                    },
                    { teamA: 0, teamB: 0 }
                  )

                  return (
                    <div
                      key={match.id}
                      className="rounded-lg border border-white/15 bg-white/5 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-sm text-white/70">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-white/60" />
                          {formatDateTime(match.scheduled_at)}
                        </div>
                        <Badge variant="outline" className="border-emerald-400/40 text-emerald-200 bg-emerald-500/10">
                          Finalizado
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-white">
                        <span className="font-semibold">{match.teamA?.name || 'Equipe A'}</span>
                        <span className="text-lg font-semibold text-white/80">
                          {setTotals.teamA} x {setTotals.teamB}
                        </span>
                        <span className="font-semibold text-right">{match.teamB?.name || 'Equipe B'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-white/80">
                        {scores.length === 0 ? (
                          <span className="text-white/60">Sem placar registrado.</span>
                        ) : (
                          scores.map((score) => (
                            <span
                              key={`${score.match_id}-${score.set_number}`}
                              className="rounded border border-white/20 px-2 py-1"
                            >
                              Set {score.set_number}: {score.team_a_points} x {score.team_b_points}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
                        >
                          <Link to={`/scoreboard/${match.id}`}>Rever placar</Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40"
                        >
                          <Link to={`/spectator/${match.id}`}>Destaques da torcida</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default TournamentInfoDetail
