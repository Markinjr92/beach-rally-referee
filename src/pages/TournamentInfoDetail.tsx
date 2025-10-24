import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Trophy, Activity, UserCheck } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDatePtBr, formatDateTimePtBr, parseLocalDateTime } from '@/utils/date'
import { Game, GameState } from '@/types/volleyball'
import { createDefaultGameState } from '@/lib/matchState'
import { loadMatchStates, subscribeToMatchState } from '@/lib/matchStateService'

type Tournament = Tables<'tournaments'>
type Match = Tables<'matches'>
type Team = Tables<'teams'>
type MatchScore = Tables<'match_scores'>
type User = Tables<'users'>

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
  const [matchStates, setMatchStates] = useState<Record<string, GameState>>({})
  const [gameConfigs, setGameConfigs] = useState<Record<string, Game>>({})
  const [referees, setReferees] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<'date-asc' | 'date-desc' | 'status' | 'phase'>('date-asc')
  const [showLiveOnly, setShowLiveOnly] = useState(false)
  const [timerTick, setTimerTick] = useState(() => Date.now())
  const [usingMatchStateFallback, setUsingMatchStateFallback] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setTimerTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadTournamentData = useCallback(
    async (withSpinner = false) => {
      if (!tournamentId) return
      if (withSpinner) {
        setLoading(true)
      }

      try {
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
          setMatchStates({})
          setGameConfigs({})
          setReferees({})
          return
        }

        setTournament(tournamentData)
        const hasStatistics = tournamentData?.has_statistics ?? true

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
          setMatchStates({})
          setGameConfigs({})
          setReferees({})
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

        const refereeIds = Array.from(
          new Set(
            enrichedMatches
              .map((match) => match.referee_id)
              .filter((value): value is string => Boolean(value)),
          ),
        )

        if (refereeIds.length > 0) {
          const { data: refereeData, error: refereeError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', refereeIds)

          if (refereeError) {
            console.error('Não foi possível carregar árbitros', refereeError)
          } else {
            const map = Object.fromEntries((refereeData as User[]).map((user) => [user.id, user]))
            setReferees(map)
          }
        } else {
          setReferees({})
        }

        const configs: Record<string, Game> = {}
        for (const match of enrichedMatches) {
          const config: Game = {
            id: match.id,
            tournamentId: match.tournament_id,
            title: `${match.teamA?.name ?? 'Equipe A'} vs ${match.teamB?.name ?? 'Equipe B'}`,
            category: match.modality ? String(match.modality) : 'Misto',
            modality: (match.modality as any) || 'dupla',
            format: 'melhorDe3',
            teamA: {
              name: match.teamA?.name || 'Equipe A',
              players: [
                { name: match.teamA?.player_a || 'A1', number: 1 },
                { name: match.teamA?.player_b || 'A2', number: 2 },
              ],
            },
            teamB: {
              name: match.teamB?.name || 'Equipe B',
              players: [
                { name: match.teamB?.player_a || 'B1', number: 1 },
                { name: match.teamB?.player_b || 'B2', number: 2 },
              ],
            },
            pointsPerSet: (match.points_per_set as any) || [21, 21, 15],
            needTwoPointLead: true,
            sideSwitchSum: (match.side_switch_sum as any) || [7, 7, 5],
            hasTechnicalTimeout: false,
            technicalTimeoutSum: 0,
            teamTimeoutsPerSet: 2,
            teamTimeoutDurationSec: 30,
            coinTossMode: 'initialThenAlternate',
            status:
              match.status === 'in_progress'
                ? 'em_andamento'
                : match.status === 'completed'
                  ? 'finalizado'
                  : 'agendado',
            createdAt: match.created_at || new Date().toISOString(),
            updatedAt: match.created_at || new Date().toISOString(),
            hasStatistics,
          }
          configs[match.id] = config
        }

        setGameConfigs(configs)

        const matchIds = enrichedMatches.map((match) => match.id)

        if (matchIds.length > 0) {
          try {
            const { states, usedFallback } = await loadMatchStates(matchIds, configs)
            setMatchStates(states)
            setUsingMatchStateFallback(usedFallback)
          } catch (error) {
            console.error('Não foi possível carregar os estados das partidas', error)
            setMatchStates({})
            setUsingMatchStateFallback(false)
          }
        } else {
          setMatchStates({})
          setUsingMatchStateFallback(false)
        }

        if (matchIds.length > 0) {
          const { data: scoreData, error: scoreError } = await supabase
            .from('match_scores')
            .select('*')
            .in('match_id', matchIds)
            .order('set_number', { ascending: true })

          if (scoreError) {
            toast({
              title: 'Não foi possível carregar os placares',
              description: scoreError.message,
              variant: 'destructive',
            })
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
        } else {
          setScoresByMatch({})
        }
      } finally {
        setLoading(false)
      }
    },
    [tournamentId, toast],
  )

  useEffect(() => {
    void loadTournamentData(true)
    const interval = setInterval(() => {
      void loadTournamentData()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadTournamentData])

  useEffect(() => {
    if (Object.keys(gameConfigs).length === 0) return

    const unsubscribeList = Object.entries(gameConfigs).map(([matchId, config]) =>
      subscribeToMatchState(matchId, config, (state) => {
        setMatchStates((prev) => ({
          ...prev,
          [matchId]: state,
        }))
      }),
    )

    return () => {
      unsubscribeList.forEach((unsubscribe) => unsubscribe?.())
    }
  }, [gameConfigs, usingMatchStateFallback])

  const filteredAndSortedMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    const filtered = matches.filter((match) => {
      if (showLiveOnly && match.status !== 'in_progress') {
        return false
      }

      if (!term) return true

      const teamA = match.teamA?.name?.toLowerCase() || ''
      const teamB = match.teamB?.name?.toLowerCase() || ''
      const phase = match.phase?.toLowerCase() || ''
      const court = match.court?.toLowerCase() || ''
      const status = match.status?.toLowerCase() || ''
      const scheduled = formatDateTimePtBr(match.scheduled_at, { fallback: '' }).toLowerCase()

      const searchPool = [teamA, teamB, phase, court, status, scheduled]

      return searchPool.some((value) => value.includes(term))
    })

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-desc': {
          const dateA = parseLocalDateTime(a.scheduled_at)?.getTime() ?? 0
          const dateB = parseLocalDateTime(b.scheduled_at)?.getTime() ?? 0
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
          const dateA = parseLocalDateTime(a.scheduled_at)?.getTime() ?? 0
          const dateB = parseLocalDateTime(b.scheduled_at)?.getTime() ?? 0
          return dateA - dateB
        }
      }
    })

    return sorted
  }, [matches, searchTerm, showLiveOnly, sortOption])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

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
                {formatDatePtBr(tournament.start_date)}
                <span className="text-white/50">até</span>
                {formatDatePtBr(tournament.end_date)}
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg font-semibold">Jogos do torneio</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por equipe, fase, quadra ou status"
                  className="h-9 bg-white/5 border-white/20 text-white placeholder:text-white/60"
                />
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as typeof sortOption)}>
                  <SelectTrigger className="h-9 bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Ordenar jogos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 text-white">
                    <SelectItem value="date-asc">Data crescente</SelectItem>
                    <SelectItem value="date-desc">Data decrescente</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="phase">Fase</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLiveOnly((prev) => !prev)}
                  className={`h-9 border-white/20 px-4 font-semibold text-white transition ${
                    showLiveOnly
                      ? 'border-emerald-300/50 bg-emerald-500/80 text-emerald-950 hover:bg-emerald-500'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Ao vivo
                </Button>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Explore todos os confrontos programados e finalizados do torneio em um único painel.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {usingMatchStateFallback && (
              <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Alguns recursos em tempo real estão limitados. Apenas os placares básicos estão sendo sincronizados com o
                servidor no momento.
              </div>
            )}
            {filteredAndSortedMatches.length === 0 ? (
              <p className="text-sm text-white/70">Nenhum jogo encontrado com os critérios atuais.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredAndSortedMatches.map((match) => {
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
                        Math.ceil(
                          (new Date(liveState.activeTimer.endsAt).getTime() - timerTick) / 1000,
                        ),
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

                  const isLive = match.status === 'in_progress'
                  const lastDisplayScore = displayScores.length > 0 ? displayScores[displayScores.length - 1] : null
                  const currentSetNumber = liveState?.currentSet ?? (isLive ? lastDisplayScore?.set_number ?? 1 : null)
                  const fallbackCurrentScore = currentSetNumber
                    ? displayScores.find((score) => score.set_number === currentSetNumber)
                    : undefined
                  const currentSetScoreA =
                    currentSetNumber !== null && currentSetNumber !== undefined
                      ? liveState?.scores.teamA[currentSetNumber - 1] ?? fallbackCurrentScore?.team_a_points ?? 0
                      : null
                  const currentSetScoreB =
                    currentSetNumber !== null && currentSetNumber !== undefined
                      ? liveState?.scores.teamB[currentSetNumber - 1] ?? fallbackCurrentScore?.team_b_points ?? 0
                      : null
                  const recordedScores = displayScores.filter(
                    (score) => score.team_a_points > 0 || score.team_b_points > 0,
                  )
                  const previousSetScores =
                    currentSetNumber !== null && currentSetNumber !== undefined
                      ? recordedScores.filter((score) => score.set_number < currentSetNumber)
                      : recordedScores

                  const referee = match.referee_id ? referees[match.referee_id] : undefined
                  const serverLabel = liveState
                    ? `${serverName ?? 'Equipe'} #${liveState.currentServerPlayer}`
                    : null
                  const statusLabel =
                    match.status === 'in_progress'
                      ? 'Em andamento'
                      : match.status === 'completed'
                        ? 'Finalizado'
                        : match.status || 'Agendado'

                  return (
                    <div
                      key={match.id}
                      className={`rounded-md border p-2.5 space-y-2 text-[13px] transition sm:text-xs ${
                        isLive
                          ? 'border-emerald-400/40 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 text-[11px] text-white/70">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-white/60" />
                          <span className="font-medium">{formatDateTimePtBr(match.scheduled_at)}</span>
                        </div>
                        {match.status && (
                          <Badge
                            variant="outline"
                            className={`border-white/25 uppercase tracking-[0.2em] ${
                              isLive ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-50' : 'text-white'
                            }`}
                          >
                            {statusLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{match.teamA?.name || 'Equipe A'}</span>
                          {(match.status === 'completed' || liveState) && (
                            <span className="text-[11px] font-semibold text-white/80">{setTotals.teamA}</span>
                          )}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.35em] text-white/40 text-center">vs</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{match.teamB?.name || 'Equipe B'}</span>
                          {(match.status === 'completed' || liveState) && (
                            <span className="text-[11px] font-semibold text-white/80">{setTotals.teamB}</span>
                          )}
                        </div>
                      </div>
                      {isLive && currentSetNumber ? (
                        <div className="rounded-lg border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-white">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-emerald-100/80">
                            <span>Set {currentSetNumber}</span>
                            <span>Ao vivo</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-base font-semibold sm:text-lg">
                            <span className="truncate pr-2">{match.teamA?.name || 'Equipe A'}</span>
                            <span className="text-2xl font-bold text-emerald-100 sm:text-3xl">
                              {currentSetScoreA ?? 0} x {currentSetScoreB ?? 0}
                            </span>
                            <span className="truncate pl-2 text-right">{match.teamB?.name || 'Equipe B'}</span>
                          </div>
                          {previousSetScores.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-emerald-50/90">
                              {previousSetScores.map((score) => (
                                <span
                                  key={`${score.match_id}-${score.set_number}-prev`}
                                  className="rounded border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5"
                                >
                                  Set {score.set_number}: {score.team_a_points} x {score.team_b_points}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-emerald-50/90">
                            <span>Servindo: {serverLabel ?? '—'}</span>
                            <span>Posse: {possessionName ?? '—'}</span>
                          </div>
                          {activeTimerRemaining !== null && liveState?.activeTimer && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-100">
                              <Clock size={12} />
                              {(timerLabel ?? 'Tempo Oficial')} · {formatTime(activeTimerRemaining)}
                            </div>
                          )}
                        </div>
                      ) : recordedScores.length > 0 ? (
                        <div className="flex flex-wrap gap-1 text-[10px] text-white/75">
                          {recordedScores.map((score) => (
                            <span
                              key={`${score.match_id}-${score.set_number}`}
                              className="rounded border border-white/15 px-1.5 py-0.5"
                            >
                              Set {score.set_number}: {score.team_a_points} x {score.team_b_points}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/65">
                        {match.phase && (
                          <span className="rounded-full border border-white/15 px-2 py-0.5">{match.phase}</span>
                        )}
                        {match.court && (
                          <span className="rounded-full border border-white/15 px-2 py-0.5">Quadra {match.court}</span>
                        )}
                        {referee?.name && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-white/80">
                            <UserCheck size={12} className="text-white/60" />
                            {referee.name}
                          </span>
                        )}
                      </div>
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
