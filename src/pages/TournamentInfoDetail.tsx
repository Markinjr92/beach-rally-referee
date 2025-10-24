import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Trophy } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<'date-asc' | 'date-desc' | 'status' | 'phase'>('date-asc')

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

  const filteredAndSortedMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    const filtered = matches.filter((match) => {
      if (!term) return true

      const teamA = match.teamA?.name?.toLowerCase() || ''
      const teamB = match.teamB?.name?.toLowerCase() || ''
      const phase = match.phase?.toLowerCase() || ''
      const court = match.court?.toLowerCase() || ''
      const status = match.status?.toLowerCase() || ''
      const scheduled = match.scheduled_at
        ? new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
            .format(new Date(match.scheduled_at))
            .toLowerCase()
        : ''

      const searchPool = [teamA, teamB, phase, court, status, scheduled]

      return searchPool.some((value) => value.includes(term))
    })

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-desc': {
          const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
          const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
          return dateB - dateA
        }
        case 'status': {
          const statusA = a.status || ''
          const statusB = b.status || ''
          return statusA.localeCompare(statusB)
        }
        case 'phase': {
          const phaseA = a.phase || ''
          const phaseB = b.phase || ''
          return phaseA.localeCompare(phaseB)
        }
        case 'date-asc':
        default: {
          const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
          const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
          return dateA - dateB
        }
      }
    })

    return sorted
  }, [matches, searchTerm, sortOption])

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

        <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-xl">Jogos do torneio</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por equipe, fase, quadra ou status"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60"
                />
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as typeof sortOption)}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Ordenar jogos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 text-white">
                    <SelectItem value="date-asc">Data crescente</SelectItem>
                    <SelectItem value="date-desc">Data decrescente</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="phase">Fase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Explore todos os confrontos programados e finalizados do torneio em um único painel.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredAndSortedMatches.length === 0 ? (
              <p className="text-sm text-white/70">Nenhum jogo encontrado com os critérios atuais.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredAndSortedMatches.map((match) => {
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
                      className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-3.5 space-y-2 text-xs sm:text-sm"
                    >
                      <div className="flex items-start justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-white/50" />
                          <span className="tracking-normal text-white/70">
                            {formatDateTime(match.scheduled_at)}
                          </span>
                        </div>
                        {match.status && (
                          <Badge variant="outline" className="border-white/25 bg-white/5 text-white uppercase tracking-[0.2em]">
                            {match.status === 'in_progress'
                              ? 'Em andamento'
                              : match.status === 'completed'
                                ? 'Finalizado'
                                : match.status}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5 text-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">
                            {match.teamA?.name || 'Equipe A'}
                          </span>
                          {match.status === 'completed' && (
                            <span className="text-xs font-semibold text-white/80">
                              {setTotals.teamA}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.4em] text-white/50 text-center">
                          vs
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">
                            {match.teamB?.name || 'Equipe B'}
                          </span>
                          {match.status === 'completed' && (
                            <span className="text-xs font-semibold text-white/80">
                              {setTotals.teamB}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-white/70">
                        {match.phase && (
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            {match.phase}
                          </span>
                        )}
                        {match.court && (
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Quadra {match.court}
                          </span>
                        )}
                      </div>
                      {scores.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[10px] sm:text-[11px] text-white/75">
                          {scores.map((score) => (
                            <span
                              key={`${score.match_id}-${score.set_number}`}
                              className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5"
                            >
                              Set {score.set_number}: {score.team_a_points} x {score.team_b_points}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TournamentInfoDetail
