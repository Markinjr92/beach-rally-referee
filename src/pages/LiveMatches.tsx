import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowLeft, Clock, Trophy, UserCheck } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { loadMatchStates } from '@/lib/matchStateService'
import type { Game, GameState } from '@/types/volleyball'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatDateTimePtBr } from '@/utils/date'
import { inferMatchFormat, parseGameModality, parseNumberArray } from '@/utils/parsers'
import { buildPlayersFromTeam } from '@/utils/teamPlayers'

type Match = Tables<'matches'>
type Team = Tables<'teams'>
type Tournament = Tables<'tournaments'>
type MatchScore = Tables<'match_scores'>
type User = Tables<'users'>

type MatchWithRelations = Match & {
  teamA?: Team | null
  teamB?: Team | null
  tournament?: Tournament | null
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const LiveMatches = () => {
  const { toast } = useToast()
  const [matches, setMatches] = useState<MatchWithRelations[]>([])
  const [matchStates, setMatchStates] = useState<Record<string, GameState>>({})
  const [scoresByMatch, setScoresByMatch] = useState<Record<string, MatchScore[]>>({})
  const [referees, setReferees] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [usingMatchStateFallback, setUsingMatchStateFallback] = useState(false)
  const [timerTick, setTimerTick] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setTimerTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadLiveMatches = useCallback(
    async (withSpinner = false) => {
      if (withSpinner) {
        setLoading(true)
      }

      const notifyError = (title: string, description: string) => {
        if (withSpinner) {
          toast({ title, description, variant: 'destructive' })
        } else {
          console.error(`${title}: ${description}`)
        }
      }

      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'in_progress')
          .order('scheduled_at', { ascending: true })

        if (matchError) {
          notifyError('Não foi possível carregar os jogos ao vivo', matchError.message)
          setMatches([])
          setMatchStates({})
          setScoresByMatch({})
          setReferees({})
          setUsingMatchStateFallback(false)
          return
        }

        const liveMatches = matchData ?? []
        if (liveMatches.length === 0) {
          setMatches([])
          setMatchStates({})
          setScoresByMatch({})
          setReferees({})
          setUsingMatchStateFallback(false)
          return
        }

        const teamIds = Array.from(new Set(liveMatches.flatMap((match) => [match.team_a_id, match.team_b_id])))
        const tournamentIds = Array.from(new Set(liveMatches.map((match) => match.tournament_id)))
        const refereeIds = Array.from(
          new Set(liveMatches.map((match) => match.referee_id).filter((value): value is string => Boolean(value)))
        )

        let teamMap = new Map<string, Team>()
        if (teamIds.length > 0) {
          const { data: teamData, error: teamError } = await supabase.from('teams').select('*').in('id', teamIds)
          if (teamError) {
            notifyError('Não foi possível carregar as equipes', teamError.message)
          } else {
            teamMap = new Map((teamData ?? []).map((team) => [team.id, team]))
          }
        }

        let tournamentMap = new Map<string, Tournament>()
        if (tournamentIds.length > 0) {
          const { data: tournamentData, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .in('id', tournamentIds)
          if (tournamentError) {
            notifyError('Não foi possível carregar os torneios', tournamentError.message)
          } else {
            tournamentMap = new Map((tournamentData ?? []).map((tournament) => [tournament.id, tournament]))
          }
        }

        if (refereeIds.length > 0) {
          const { data: refereeData, error: refereeError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', refereeIds)
          if (refereeError) {
            console.error('Não foi possível carregar árbitros', refereeError)
          } else {
            setReferees(Object.fromEntries((refereeData as User[]).map((user) => [user.id, user])))
          }
        } else {
          setReferees({})
        }

        const enrichedMatches: MatchWithRelations[] = liveMatches.map((match) => ({
          ...match,
          teamA: teamMap.get(match.team_a_id) ?? null,
          teamB: teamMap.get(match.team_b_id) ?? null,
          tournament: tournamentMap.get(match.tournament_id) ?? null,
        }))

        setMatches(enrichedMatches)

        const configs: Record<string, Game> = {}
        for (const match of enrichedMatches) {
          const tournamentStats = tournamentMap.get(match.tournament_id)?.has_statistics ?? true
          const pointsPerSet = parseNumberArray(match.points_per_set, [21, 21, 15])
          const sideSwitchSum = parseNumberArray(match.side_switch_sum, [7, 7, 5])
          const format = inferMatchFormat(match.best_of, pointsPerSet)

          configs[match.id] = {
            id: match.id,
            tournamentId: match.tournament_id,
            title: `${match.teamA?.name ?? 'Equipe A'} vs ${match.teamB?.name ?? 'Equipe B'}`,
            category: match.modality ? String(match.modality) : 'Misto',
            modality: parseGameModality(match.modality),
            format,
            teamA: {
              name: match.teamA?.name || 'Equipe A',
              players: match.teamA ? buildPlayersFromTeam(match.teamA, parseGameModality(match.modality)) : [
                { name: 'A1', number: 1 },
                { name: 'A2', number: 2 },
              ],
            },
            teamB: {
              name: match.teamB?.name || 'Equipe B',
              players: match.teamB ? buildPlayersFromTeam(match.teamB, parseGameModality(match.modality)) : [
                { name: 'B1', number: 1 },
                { name: 'B2', number: 2 },
              ],
            },
            pointsPerSet,
            needTwoPointLead: true,
            sideSwitchSum,
            hasTechnicalTimeout: false,
            technicalTimeoutSum: 0,
            teamTimeoutsPerSet: 2,
            teamTimeoutDurationSec: 30,
            coinTossMode: 'initialThenAlternate',
            status: 'em_andamento',
            createdAt: match.created_at || new Date().toISOString(),
            updatedAt: match.created_at || new Date().toISOString(),
            hasStatistics: tournamentStats,
          }
        }

        const matchIds = enrichedMatches.map((match) => match.id)

        try {
          const { states, usedFallback } = await loadMatchStates(matchIds, configs)
          setMatchStates(states)
          setUsingMatchStateFallback(usedFallback)
        } catch (error) {
          console.error('Não foi possível carregar os estados das partidas', error)
          setMatchStates({})
          setUsingMatchStateFallback(false)
        }

        const { data: scoreData, error: scoreError } = await supabase
          .from('match_scores')
          .select('*')
          .in('match_id', matchIds)
          .order('set_number', { ascending: true })

        if (scoreError) {
          notifyError('Não foi possível carregar os placares', scoreError.message)
          setScoresByMatch({})
        } else {
          const grouped =
            scoreData?.reduce<Record<string, MatchScore[]>>((acc, score) => {
              acc[score.match_id] = acc[score.match_id] || []
              acc[score.match_id].push(score)
              return acc
            }, {}) || {}
          setScoresByMatch(grouped)
        }
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    void loadLiveMatches(true)
    const interval = setInterval(() => {
      void loadLiveMatches()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadLiveMatches])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        <div className="text-lg text-white/80">Carregando jogos ao vivo...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button
            asChild
            variant="ghost"
            className="w-fit bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
          >
            <Link to="/">
              <ArrowLeft size={18} className="mr-2" />
              Voltar
            </Link>
          </Button>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80">
            <Activity size={16} className="text-emerald-300" />
            Atualização automática a cada 5 segundos
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Jogos ao vivo</h1>
          <p className="text-white/70">Acompanhe todos os confrontos em andamento nos torneios cadastrados.</p>
        </div>

        {usingMatchStateFallback && (
          <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Alguns recursos em tempo real estão limitados. Apenas os placares básicos estão sendo sincronizados com o servidor no
            momento.
          </div>
        )}

        {matches.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-white/5 px-6 py-8 text-sm text-white/70">
            Nenhuma partida está em andamento no momento.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {matches.map((match) => {
              const scores = scoresByMatch[match.id] || []
              const liveState = matchStates[match.id]
              const displayScores = liveState
                ? liveState.scores.teamA.map((points, index) => ({
                    match_id: match.id,
                    set_number: index + 1,
                    team_a_points: points,
                    team_b_points: liveState.scores.teamB[index] ?? 0,
                  }))
                : scores

              const setTotals = liveState
                ? liveState.setsWon
                : scores.reduce(
                    (acc, score) => {
                      if (score.team_a_points > score.team_b_points) acc.teamA += 1
                      if (score.team_b_points > score.team_a_points) acc.teamB += 1
                      return acc
                    },
                    { teamA: 0, teamB: 0 }
                  )

              const activeTimerRemaining = liveState?.activeTimer
                ? Math.max(
                    0,
                    Math.ceil((new Date(liveState.activeTimer.endsAt).getTime() - timerTick) / 1000),
                  )
                : null

              const timerLabel = liveState?.activeTimer
                ? (() => {
                    const typeLabels: Record<string, string> = {
                      TIMEOUT_TEAM: 'Tempo de Equipe',
                      TIMEOUT_TECHNICAL: 'Tempo Técnico',
                      MEDICAL: 'Tempo Médico',
                      SET_INTERVAL: 'Intervalo de Set',
                    }
                    const baseLabel = typeLabels[liveState.activeTimer.type] ?? 'Tempo Oficial'
                    if (!liveState.activeTimer.team) {
                      return baseLabel
                    }
                    const teamName =
                      liveState.activeTimer.team === 'A'
                        ? match.teamA?.name ?? 'Equipe A'
                        : match.teamB?.name ?? 'Equipe B'
                    return `${baseLabel} • ${teamName}`
                  })()
                : null

              const possessionName = liveState
                ? liveState.possession === 'A'
                  ? match.teamA?.name ?? 'Equipe A'
                  : match.teamB?.name ?? 'Equipe B'
                : null

              const serverName = liveState
                ? liveState.currentServerTeam === 'A'
                  ? match.teamA?.name ?? 'Equipe A'
                  : match.teamB?.name ?? 'Equipe B'
                : null

              const lastDisplayScore = displayScores.length > 0 ? displayScores[displayScores.length - 1] : null
              const currentSetNumber = liveState?.currentSet ?? lastDisplayScore?.set_number ?? 1
              const fallbackCurrentScore = displayScores.find((score) => score.set_number === currentSetNumber)
              const currentSetScoreA = liveState?.scores.teamA[currentSetNumber - 1] ?? fallbackCurrentScore?.team_a_points ?? 0
              const currentSetScoreB = liveState?.scores.teamB[currentSetNumber - 1] ?? fallbackCurrentScore?.team_b_points ?? 0
              const recordedScores = displayScores.filter(
                (score) => score.team_a_points > 0 || score.team_b_points > 0,
              )
              const previousSetScores = recordedScores.filter((score) => score.set_number < currentSetNumber)
              const serverLabel = liveState ? `${serverName ?? 'Equipe'} #${liveState.currentServerPlayer}` : null
              const referee = match.referee_id ? referees[match.referee_id] : undefined

              return (
                <Card
                  key={match.id}
                  className="border border-emerald-400/40 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/10"
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-white/75">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} className="text-white/60" />
                        {formatDateTimePtBr(match.scheduled_at)}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-emerald-300/40 bg-emerald-500/25 text-emerald-50 uppercase tracking-[0.25em]"
                      >
                        Ao vivo
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-semibold">
                      {match.teamA?.name || 'Equipe A'} vs {match.teamB?.name || 'Equipe B'}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <Trophy size={12} className="text-yellow-300" />
                      <span>{match.tournament?.name ?? 'Torneio não definido'}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-4 py-3 text-white">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-emerald-100/80">
                        <span>Set {currentSetNumber}</span>
                        <span>Placar parcial</span>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-lg font-semibold sm:text-xl">
                        <span className="truncate text-left">{match.teamA?.name || 'Equipe A'}</span>
                        <span className="text-3xl font-bold text-emerald-100 sm:text-4xl">
                          {currentSetScoreA} x {currentSetScoreB}
                        </span>
                        <span className="truncate text-right">{match.teamB?.name || 'Equipe B'}</span>
                      </div>
                      <div className="mt-2 text-[11px] text-emerald-100/80">Sets: {setTotals.teamA} - {setTotals.teamB}</div>
                      {previousSetScores.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-emerald-50/90">
                          {previousSetScores.map((score) => (
                            <span
                              key={`${score.match_id}-${score.set_number}`}
                              className="rounded border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5"
                            >
                              Set {score.set_number}: {score.team_a_points} x {score.team_b_points}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-50/90">
                        <span>Servindo: {serverLabel ?? '—'}</span>
                        <span>Posse: {possessionName ?? '—'}</span>
                      </div>
                      {activeTimerRemaining !== null && liveState?.activeTimer && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-100">
                          <Clock size={12} />
                          {(timerLabel ?? 'Tempo Oficial')} · {formatTime(activeTimerRemaining)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                      {match.phase && (
                        <span className="rounded-full border border-white/15 px-3 py-0.5">Fase: {match.phase}</span>
                      )}
                      {match.court && (
                        <span className="rounded-full border border-white/15 px-3 py-0.5">Quadra {match.court}</span>
                      )}
                      {referee?.name && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-0.5">
                          <UserCheck size={12} className="text-white/60" />
                          {referee.name}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveMatches
