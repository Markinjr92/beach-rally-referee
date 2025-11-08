import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Check, ChevronsUpDown, Upload, Image as ImageIcon, Edit2, Save, X, Play, AlertCircle } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { formatDateShortPtBr, formatDateTimePtBr, toDatetimeLocalInputValue } from '@/utils/date'
import { getMatchConfigFromFormat, MATCH_FORMAT_PRESETS, type MatchFormatPresetKey } from '@/utils/matchConfig'
import {
  GroupAssignment,
  GroupStanding,
  buildGroupAssignments,
  computeStandingsByGroup,
} from '@/utils/tournamentStandings'
import { 
  availableTournamentFormats, 
  defaultTieBreakerOrder,
  checkPhaseCompletion,
  getTournamentPhases,
} from '@/lib/tournament'
import { getBracketSectionForPhase, type BracketSection } from '@/lib/tournament/bracketCriteria'
import { getNextPhaseLabel, phaseFormatKeyMap } from '@/lib/tournament/phaseConfig'
import type { GameState, TournamentFormatId, TieBreakerCriterion } from '@/types/volleyball'
import { TournamentBracketCriteria } from '@/components/TournamentBracketCriteria'
import { ConfirmDialog } from '@/components/ConfirmDialog'

type Tournament = Tables<'tournaments'>
type Team = Tables<'teams'>
type Match = Tables<'matches'>
type MatchScore = Tables<'match_scores'>
type MatchStateRecord = Pick<Tables<'match_states'>, 'match_id' | 'scores' | 'sets_won'>
type MatchSetupEntry = {
  id: string
  label: string
  description: string
  phase: string
  teamAId: string
  teamBId: string
  bestOf: number
  pointsText: string
  sideSwitchText: string
}

type TeamOption = { value: string; label: string }

const MATCH_MODES = Object.entries(MATCH_FORMAT_PRESETS).map(([value, preset]) => ({
  value: value as MatchFormatPresetKey,
  label: preset.label,
  bestOf: preset.bestOf,
  pointsPerSet: preset.pointsPerSet,
  sideSwitchSum: preset.sideSwitchSum,
}))

type MatchModeValue = MatchFormatPresetKey

type TeamSearchSelectProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: TeamOption[]
}

const TeamSearchSelect = ({ value, onChange, placeholder, options }: TeamSearchSelectProps) => {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            'w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15 focus-visible:ring-white/50 focus-visible:ring-offset-0',
            !selected && 'text-white/60'
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 border border-white/20 text-white"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command className="bg-slate-950/95 text-white">
          <CommandInput
            placeholder={`Buscar ${placeholder.toLowerCase()}`}
            className="text-white placeholder:text-white/60"
          />
          <CommandEmpty>Nenhuma dupla encontrada.</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className="text-white data-[selected=true]:bg-white/15 data-[selected=true]:text-white data-[highlighted=true]:bg-white/10 data-[highlighted=true]:text-white"
              >
                <Check className={cn('mr-2 h-4 w-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type MatchFormState = {
  teamA: string
  teamB: string
  scheduled_at: string
  court: string
  mode: MatchModeValue
}

type EditingMatch = {
  id: string
  scheduled_at: string
  court: string
  phase: string
} | null

type EditingTeam = {
  id: string
  name: string
  player_a: string
  player_b: string
} | null

type MatchFormatOption = 'melhorDe1' | 'melhorDe3' | 'melhorDe3_15' | 'melhorDe3_15_10'

type TournamentConfig = {
  formatId?: TournamentFormatId
  tieBreakerOrder?: TieBreakerCriterion[]
  includeThirdPlace?: boolean
  matchFormats?: {
    groups?: MatchFormatOption
    quarterfinals?: MatchFormatOption
    semifinals?: MatchFormatOption
    final?: MatchFormatOption
    thirdPlace?: MatchFormatOption
  }
}

type TournamentTeamRecord = {
  team_id: string
  group_label: string | null
  teams: Team | null
}

const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num))

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => toFiniteNumber(item, 0))
}

const parseTeamScoreArrays = (value: unknown): { teamA: number[]; teamB: number[] } => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return {
      teamA: toNumberArray(record.teamA),
      teamB: toNumberArray(record.teamB),
    }
  }
  return { teamA: [], teamB: [] }
}

const parseTeamSets = (value: unknown): { teamA: number; teamB: number } => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return {
      teamA: toFiniteNumber(record.teamA, 0),
      teamB: toFiniteNumber(record.teamB, 0),
    }
  }
  return { teamA: 0, teamB: 0 }
}

const mapMatchStateRowToGameState = (row: MatchStateRecord): GameState | null => {
  const setsWon = parseTeamSets(row.sets_won)
  const scores = parseTeamScoreArrays(row.scores)
  const hasSetData = setsWon.teamA > 0 || setsWon.teamB > 0
  const hasScoreData =
    scores.teamA.some((value) => value > 0) || scores.teamB.some((value) => value > 0)

  if (!hasSetData && !hasScoreData) {
    return null
  }

  const totalSets = Math.max(scores.teamA.length, scores.teamB.length, setsWon.teamA + setsWon.teamB, 1)
  const padScores = (list: number[]) =>
    list.length >= totalSets ? list : [...list, ...new Array(totalSets - list.length).fill(0)]

  return {
    id: row.match_id,
    gameId: row.match_id,
    currentSet: totalSets,
    setsWon,
    scores: {
      teamA: padScores(scores.teamA),
      teamB: padScores(scores.teamB),
    },
    currentServerTeam: 'A',
    currentServerPlayer: 1,
    possession: 'A',
    leftIsTeamA: true,
    timeoutsUsed: {
      teamA: new Array(totalSets).fill(0),
      teamB: new Array(totalSets).fill(0),
    },
    technicalTimeoutUsed: new Array(totalSets).fill(false),
    sidesSwitched: new Array(totalSets).fill(0),
    serviceOrders: { teamA: [], teamB: [] },
    nextServerIndex: { teamA: 0, teamB: 0 },
    setConfigurations: [],
    isGameEnded: true,
  }
}

const MATCH_FORMAT_LABELS: Record<MatchFormatOption, string> = {
  melhorDe3: 'Melhor de 3 sets (21/21/15)',
  melhorDe3_15: 'Melhor de 3 sets (15/15/15)',
  melhorDe3_15_10: 'Melhor de 3 sets (15/15/10)',
  melhorDe1: 'Set único de 21 pontos',
}

const PHASE_LABELS: Record<string, string> = {
  groups: 'Fase de grupos',
  quarterfinals: 'Quartas de final',
  semifinals: 'Semifinais',
  final: 'Final',
  thirdPlace: 'Disputa de 3º',
}

const TIE_BREAKER_LABELS: Record<TieBreakerCriterion, string> = {
  head_to_head: 'Confronto direto (2 equipes)',
  sets_average_inner: 'Average de sets entre empatadas',
  points_average_inner: 'Average de pontos entre empatadas',
  sets_average_global: 'Average de sets na fase',
  points_average_global: 'Average de pontos na fase',
  random_draw: 'Sorteio',
}

export default function TournamentDetailDB() {
  const { tournamentId } = useParams()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { roles } = useUserRoles(user, authLoading)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teamForm, setTeamForm] = useState({ name: '', player_a: '', player_b: '' })
  const [matchForm, setMatchForm] = useState<MatchFormState>({
    teamA: '',
    teamB: '',
    scheduled_at: '',
    court: '',
    mode: MATCH_MODES[0].value,
  })
  const [editingTeam, setEditingTeam] = useState<EditingTeam>(null)
  const [editingMatch, setEditingMatch] = useState<EditingMatch>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [sponsorLogos, setSponsorLogos] = useState<string[]>([])
  const [newSponsorUrl, setNewSponsorUrl] = useState('')
  const [teamGroups, setTeamGroups] = useState<Record<string, string | null>>({})
  const [matchScores, setMatchScores] = useState<MatchScore[]>([])
  const [matchStates, setMatchStates] = useState<Record<string, GameState>>({})
  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig | null>(null)
  
  // Phase advancement states
  const [availablePhases, setAvailablePhases] = useState<string[]>([])
  const [currentPhaseFilter, setCurrentPhaseFilter] = useState<string>('')
  const [showAdvancePhaseDialog, setShowAdvancePhaseDialog] = useState(false)
  const [phaseCheckResult, setPhaseCheckResult] = useState<{
    canAdvance: boolean
    currentPhase: string
    totalMatches: number
    completedMatches: number
    pendingMatches: Match[]
    message: string
  } | null>(null)
  const [matchSetupPhase, setMatchSetupPhase] = useState<string>('')
  const [matchSetupEntries, setMatchSetupEntries] = useState<MatchSetupEntry[]>([])
  const [showMatchSetupDialog, setShowMatchSetupDialog] = useState(false)
  const [isSavingMatchSetup, setIsSavingMatchSetup] = useState(false)
  const [matchSetupError, setMatchSetupError] = useState<string | null>(null)
  const [nextPhaseSection, setNextPhaseSection] = useState<BracketSection | null>(null)

  const loadTournamentTeams = useCallback(async () => {
    if (!tournamentId) return

    const { data: reg, error: re } = await supabase
      .from('tournament_teams')
      .select('team_id, group_label, teams(*)')
      .eq('tournament_id', tournamentId)

    if (re) {
      toast({ title: 'Erro ao carregar equipes', description: re.message })
      setTeams([])
      setTeamGroups({})
      return
    }

    const registeredTeams = (reg ?? []) as TournamentTeamRecord[]
    const normalizedTeams = registeredTeams
      .map((record) => record.teams)
      .filter((team): team is Team => Boolean(team))

    setTeams(normalizedTeams)

    const groupsMap: Record<string, string | null> = {}
    registeredTeams.forEach((record) => {
      const team = record.teams
      if (team) {
        groupsMap[team.id] = record.group_label
      }
    })
    setTeamGroups(groupsMap)
  }, [tournamentId, toast])

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) return
      const { data: t, error: te } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      if (te) { toast({ title: 'Erro ao carregar torneio', description: te.message }); return }
      setTournament(t)

      await loadTournamentTeams()

      const { data: m, error: me } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('scheduled_at', { ascending: true })
      if (me) { toast({ title: 'Erro ao carregar jogos', description: me.message }) }
      setMatches(m || [])

      // Load logos
      if (t.logo_url) setLogoUrl(t.logo_url)
      if (t.sponsor_logos && Array.isArray(t.sponsor_logos)) {
        setSponsorLogos(t.sponsor_logos as string[])
      }
    }
    load()
  }, [tournamentId, toast, loadTournamentTeams])

  useEffect(() => {
    if (matchForm.scheduled_at) return

    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const scheduled = matches[index]?.scheduled_at
      if (scheduled) {
        setMatchForm(prev => ({ ...prev, scheduled_at: toDatetimeLocalInputValue(scheduled) }))
        break
      }
    }
  }, [matches, matchForm.scheduled_at])

  useEffect(() => {
    const loadConfig = async () => {
      if (!tournament) return
      
      // Load configuration from database fields
      const config: TournamentConfig = {
        formatId: tournament.format_id as TournamentFormatId | undefined,
        tieBreakerOrder: tournament.tie_breaker_order as TieBreakerCriterion[] | undefined,
        includeThirdPlace: tournament.include_third_place ?? true,
        matchFormats: {
          groups: tournament.match_format_groups as MatchFormatOption | undefined,
          quarterfinals: tournament.match_format_quarterfinals as MatchFormatOption | undefined,
          semifinals: tournament.match_format_semifinals as MatchFormatOption | undefined,
          final: tournament.match_format_final as MatchFormatOption | undefined,
          thirdPlace: tournament.match_format_third_place as MatchFormatOption | undefined,
        },
      }
      
      setTournamentConfig(config)
    }
    
    loadConfig()
  }, [tournament])

  useEffect(() => {
    const loadScores = async () => {
      if (!matches.length) {
        setMatchScores([])
        return
      }

      const matchIds = matches.map(match => match.id)
      const { data, error } = await supabase
        .from('match_scores')
        .select('*')
        .in('match_id', matchIds)

      if (error) {
        toast({ title: 'Erro ao carregar parciais', description: error.message })
        return
      }

      setMatchScores(data || [])
    }

    loadScores()
  }, [matches, toast])

  useEffect(() => {
    let isCancelled = false

    const loadStates = async () => {
      if (!matches.length) {
        if (!isCancelled) {
          setMatchStates({})
        }
        return
      }

      const matchIds = matches.map((match) => match.id)

      try {
        const { data, error } = await supabase
          .from('match_states')
          .select('match_id, scores, sets_won')
          .in('match_id', matchIds)

        if (error) {
          if ((error as { code?: string })?.code === 'PGRST205') {
            if (!isCancelled) {
              setMatchStates({})
            }
            return
          }
          throw error
        }

        if (isCancelled) return

        const parsedStates: Record<string, GameState> = {}
        ;(data as MatchStateRecord[] | null)?.forEach((row) => {
          const mapped = mapMatchStateRowToGameState(row)
          if (mapped) {
            parsedStates[row.match_id] = mapped
          }
        })
        setMatchStates(parsedStates)
      } catch (error) {
        console.error('Erro ao carregar estados das partidas', error)
        if (!isCancelled) {
          setMatchStates({})
        }
      }
    }

    void loadStates()

    return () => {
      isCancelled = true
    }
  }, [matches])

  useEffect(() => {
    const loadPhases = async () => {
      if (!tournamentId) return
      const phases = await getTournamentPhases(tournamentId)
      setAvailablePhases(phases)
      if (phases.length > 0 && !currentPhaseFilter) {
        setCurrentPhaseFilter(phases[0])
      }
    }
    loadPhases()
  }, [tournamentId, matches, currentPhaseFilter])

  const handleCheckPhase = async (phase: string) => {
    if (!tournamentId) return
    const result = await checkPhaseCompletion(tournamentId, phase)
    setPhaseCheckResult(result)
    setShowAdvancePhaseDialog(true)
  }

  const updateMatchSetupEntry = (id: string, patch: Partial<MatchSetupEntry>) => {
    setMatchSetupEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  const handlePrepareMatchSetup = () => {
    if (!phaseCheckResult?.canAdvance || !tournamentConfig?.formatId) {
      toast({
        title: 'Fase não disponível',
        description: 'Finalize todos os jogos antes de configurar os confrontos.',
        variant: 'destructive',
      })
      return
    }

    const nextPhaseLabel = getNextPhaseLabel(tournamentConfig.formatId, phaseCheckResult.currentPhase)
    if (!nextPhaseLabel) {
      toast({
        title: 'Próxima fase não configurada',
        description: 'Não há fase seguinte definida para este formato.',
        variant: 'destructive',
      })
      return
    }

    const section = getBracketSectionForPhase(tournamentConfig.formatId, nextPhaseLabel)
    if (!section || !section.matches.length) {
      toast({
        title: 'Critérios indisponíveis',
        description: 'Defina os confrontos manualmente nas configurações do torneio.',
        variant: 'destructive',
      })
      return
    }

    const entries = section.matches.map((match, index) => {
      const phaseLabel = match.phaseOverride ?? nextPhaseLabel
      const defaults = getDefaultMatchSettings(phaseLabel)
      return {
        id: `${phaseLabel}-${match.label}-${index}`,
        label: match.label,
        description: match.description,
        phase: match.phaseOverride ?? nextPhaseLabel,
        teamAId: '',
        teamBId: '',
        bestOf: defaults.bestOf,
        pointsText: defaults.pointsPerSet.join(', '),
        sideSwitchText: defaults.sideSwitchSum.join(', '),
      }
    })

    setMatchSetupPhase(nextPhaseLabel)
    setNextPhaseSection(section)
    setMatchSetupEntries(entries)
    setMatchSetupError(null)
    setShowAdvancePhaseDialog(false)
    setShowMatchSetupDialog(true)
  }

  const handleSaveMatchSetup = async () => {
    if (!tournamentId || !matchSetupEntries.length) return

    for (const entry of matchSetupEntries) {
      if (!entry.teamAId || !entry.teamBId) {
        setMatchSetupError('Selecione as duas equipes em todos os confrontos.')
        return
      }
      if (entry.teamAId === entry.teamBId) {
        setMatchSetupError('Um confronto não pode ter a mesma equipe nos dois lados.')
        return
      }
      if (entry.bestOf <= 0) {
        setMatchSetupError('Informe o número de sets (best of) para cada confronto.')
        return
      }
      if (!parseNumberList(entry.pointsText).length) {
        setMatchSetupError('Informe os pontos por set (ex.: 21, 21, 15).')
        return
      }
      if (!parseNumberList(entry.sideSwitchText).length) {
        setMatchSetupError('Informe os valores de troca de quadra (ex.: 7, 7, 5).')
        return
      }
    }

    const payload = matchSetupEntries.map((entry) => ({
      tournament_id: tournamentId,
      team_a_id: entry.teamAId,
      team_b_id: entry.teamBId,
      phase: entry.phase,
      status: 'scheduled',
      best_of: entry.bestOf,
      points_per_set: parseNumberList(entry.pointsText),
      side_switch_sum: parseNumberList(entry.sideSwitchText),
      modality: tournament?.modality || 'dupla',
    }))

    setIsSavingMatchSetup(true)
    try {
      const { error } = await supabase.from('matches').insert(payload)
      if (error) throw error

      toast({
        title: `${matchSetupPhase} configurada`,
        description: `${payload.length} confronto(s) foram criados.`,
      })

      setShowMatchSetupDialog(false)
      setMatchSetupEntries([])
      setMatchSetupError(null)
      setPhaseCheckResult(null)

      const { data: updatedMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('scheduled_at', { ascending: true })
      setMatches(updatedMatches || [])

      const phases = await getTournamentPhases(tournamentId)
      setAvailablePhases(phases)
      if (matchSetupPhase) {
        setCurrentPhaseFilter(matchSetupPhase)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar confrontos'
      setMatchSetupError(message)
      toast({ title: 'Erro ao salvar confrontos', description: message, variant: 'destructive' })
    } finally {
      setIsSavingMatchSetup(false)
    }
  }

  const teamOptions = useMemo(() => teams.map(t => ({ value: t.id, label: t.name })), [teams])

  const getDefaultMatchSettings = useCallback(
    (phaseLabel: string) => {
      const normalized = phaseLabel.trim().toLowerCase()
      const formatKey = phaseFormatKeyMap[normalized] ?? 'groups'
      const formatOption = tournamentConfig?.matchFormats?.[formatKey]
      const config = getMatchConfigFromFormat(formatOption || tournamentConfig?.matchFormats?.groups || 'melhorDe3')
      return {
        bestOf: config.bestOf ?? 3,
        pointsPerSet: config.pointsPerSet ?? [21, 21, 15],
        sideSwitchSum: config.sideSwitchSum ?? [7, 7, 5],
      }
    },
    [tournamentConfig],
  )

  const scoresByMatch = useMemo(() => {
    const grouped = new Map<string, MatchScore[]>()

    matchScores.forEach((score) => {
      if (!grouped.has(score.match_id)) {
        grouped.set(score.match_id, [])
      }
      grouped.get(score.match_id)!.push(score)
    })

    grouped.forEach((scores) => {
      scores.sort((a, b) => a.set_number - b.set_number)
    })

    return grouped
  }, [matchScores])

  const teamNameMap = useMemo(() => {
    const map = new Map<string, string>()
    teams.forEach((team) => {
      map.set(team.id, team.name)
    })
    return map
  }, [teams])

  const isAdminSistema = roles.includes('admin_sistema')

  const groupAssignments = useMemo<GroupAssignment[]>(
    () => buildGroupAssignments(teams, teamGroups),
    [teams, teamGroups],
  )

  const standingsByGroup: GroupStanding[] = useMemo(
    () =>
      computeStandingsByGroup({
        matches,
        scoresByMatch,
        matchStates,
        groupAssignments,
        teamNameMap,
      }),
    [groupAssignments, matchStates, matches, scoresByMatch, teamNameMap],
  )

  const eliminationSummaries = useMemo(() => {
    if (!matches.length) return []

    const eliminationPhaseOrder = ['Quartas de final', 'Semifinal', 'Disputa 3º lugar', 'Final']
    const statusLabels: Record<string, string> = {
      scheduled: 'Agendado',
      in_progress: 'Em andamento',
      completed: 'Finalizado',
      cancelled: 'Cancelado',
    }

    return eliminationPhaseOrder
      .map((phaseLabel) => {
        const phaseMatches = matches.filter((match) => match.phase === phaseLabel)
        if (!phaseMatches.length) return null

        const formattedMatches = phaseMatches.map((match) => {
          const teamAName = teamNameMap.get(match.team_a_id) ?? 'Equipe A'
          const teamBName = teamNameMap.get(match.team_b_id) ?? 'Equipe B'

          const recordedScores = scoresByMatch.get(match.id) ?? []
          let resultLabel = statusLabels[match.status || 'scheduled'] || match.status || 'Agendado'

          if (recordedScores.length > 0) {
            let setsWonA = 0
            let setsWonB = 0
            const setsDescription: string[] = []

            recordedScores
              .slice()
              .sort((a, b) => a.set_number - b.set_number)
              .forEach((setScore) => {
                if (setScore.team_a_points > setScore.team_b_points) {
                  setsWonA += 1
                } else if (setScore.team_b_points > setScore.team_a_points) {
                  setsWonB += 1
                }
                setsDescription.push(`${setScore.team_a_points}x${setScore.team_b_points}`)
              })

            resultLabel = `${setsWonA} x ${setsWonB}`
            if (setsDescription.length) {
              resultLabel = `${resultLabel} (${setsDescription.join(', ')})`
            }
          }

          const metadata: string[] = []
          if (match.scheduled_at) {
            metadata.push(`Data: ${formatDateShortPtBr(match.scheduled_at, { fallback: 'A definir' })}`)
          }
          if (match.court) {
            metadata.push(`Quadra: ${match.court}`)
          }

          return {
            id: match.id,
            phase: phaseLabel,
            pairing: `${teamAName} × ${teamBName}`,
            result: resultLabel,
            metadata: metadata.join(' • '),
          }
        })

        return {
          phase: phaseLabel,
          matches: formattedMatches,
        }
      })
      .filter((entry): entry is { phase: string; matches: { id: string; phase: string; pairing: string; result: string; metadata: string }[] } => entry !== null)
  }, [matches, scoresByMatch, teamNameMap])

  if (!tournament) return (
    <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
      <p className="text-sm text-white/80">Torneio não encontrado</p>
    </div>
  )

  const formattedStartDate = formatDateShortPtBr(tournament.start_date)
  const formattedEndDate = formatDateShortPtBr(tournament.end_date)
  const formattedStartDateDetailed = formatDateShortPtBr(tournament.start_date, { fallback: 'Não definido' })
  const formattedEndDateDetailed = formatDateShortPtBr(tournament.end_date, { fallback: 'Não definido' })

  const selectedFormatName = tournamentConfig?.formatId
    ? availableTournamentFormats[tournamentConfig.formatId]?.name ?? 'Formato personalizado'
    : null

  const tieBreakerOrder = tournamentConfig?.tieBreakerOrder?.length
    ? tournamentConfig.tieBreakerOrder
    : defaultTieBreakerOrder

  const handleSaveTeamEdit = async () => {
    if (!editingTeam) return
    const { error } = await supabase
      .from('teams')
      .update({
        name: editingTeam.name,
        player_a: editingTeam.player_a,
        player_b: editingTeam.player_b,
      })
      .eq('id', editingTeam.id)
    
    if (error) {
      toast({ title: 'Erro ao atualizar dupla', description: error.message })
      return
    }
    
    setTeams(prev => prev.map(t => t.id === editingTeam.id ? { ...t, ...editingTeam } : t))
    setEditingTeam(null)
    toast({ title: 'Dupla atualizada com sucesso' })
  }

  const handleSaveLogo = async () => {
    if (!logoUrl) return
    const { error } = await supabase
      .from('tournaments')
      .update({ logo_url: logoUrl })
      .eq('id', tournament.id)
    
    if (error) {
      toast({ title: 'Erro ao salvar logo', description: error.message })
    } else {
      toast({ title: 'Logo salva com sucesso' })
    }
  }

  const handleAddSponsor = async () => {
    if (!newSponsorUrl) return
    const updated = [...sponsorLogos, newSponsorUrl]
    const { error } = await supabase
      .from('tournaments')
      .update({ sponsor_logos: updated })
      .eq('id', tournament.id)
    
    if (error) {
      toast({ title: 'Erro ao adicionar patrocinador', description: error.message })
    } else {
      setSponsorLogos(updated)
      setNewSponsorUrl('')
      toast({ title: 'Patrocinador adicionado' })
    }
  }

  const handleRemoveSponsor = async (index: number) => {
    const updated = sponsorLogos.filter((_, i) => i !== index)
    const { error } = await supabase
      .from('tournaments')
      .update({ sponsor_logos: updated })
      .eq('id', tournament.id)
    
    if (error) {
      toast({ title: 'Erro ao remover patrocinador', description: error.message })
    } else {
      setSponsorLogos(updated)
      toast({ title: 'Patrocinador removido' })
    }
  }

  const handleSaveMatchEdit = async () => {
    if (!editingMatch) return
    const { error } = await supabase
      .from('matches')
      .update({
        scheduled_at: editingMatch.scheduled_at || null,
        court: editingMatch.court || null,
        phase: editingMatch.phase || null,
      })
      .eq('id', editingMatch.id)
    
    if (error) {
      toast({ title: 'Erro ao atualizar jogo', description: error.message })
      return
    }
    
    setMatches(prev => prev.map(m => m.id === editingMatch.id ? { 
      ...m, 
      scheduled_at: editingMatch.scheduled_at || null,
      court: editingMatch.court || null,
      phase: editingMatch.phase || null,
    } : m))
    setEditingMatch(null)
    toast({ title: 'Jogo atualizado com sucesso' })
  }

  // Calculate standings
  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link to="/tournaments" className="w-fit">
                <Button
                  variant="ghost"
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
                >
                  <ArrowLeft className="mr-2" size={18} />
                  Voltar
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/80">
                  <span className="flex items-center gap-2">
                    <MapPin size={16} />
                    {tournament.location || '-'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar size={16} />
                    {formattedStartDate} — {formattedEndDate}
                  </span>
                  {tournament.category && (
                    <span className="flex items-center gap-2">
                      Categoria: {tournament.category}
                    </span>
                  )}
                  {tournament.modality && (
                    <span className="flex items-center gap-2">
                      Modalidade: {tournament.modality}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="teams" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 text-white backdrop-blur-md">
              <TabsTrigger
                value="teams"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg data-[state=active]:shadow-white/20 hover:text-white"
              >
                Duplas
              </TabsTrigger>
              <TabsTrigger
                value="matches"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg data-[state=active]:shadow-white/20 hover:text-white"
              >
                Jogos
              </TabsTrigger>
              <TabsTrigger
                value="standings"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg data-[state=active]:shadow-white/20 hover:text-white"
              >
                Tabela/Classificação
              </TabsTrigger>
              <TabsTrigger
                value="config"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg data-[state=active]:shadow-white/20 hover:text-white"
              >
                Configurações
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="teams" className="mt-0">
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">Equipes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {teams.map(team => (
                      <div key={team.id} className="flex flex-col gap-4 rounded-lg border border-white/15 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                        {editingTeam?.id === team.id ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editingTeam.name}
                              onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                              className="bg-white/10 border-white/20 text-white"
                              placeholder="Nome da dupla"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={editingTeam.player_a}
                                onChange={(e) => setEditingTeam({ ...editingTeam, player_a: e.target.value })}
                                className="bg-white/10 border-white/20 text-white"
                                placeholder="Jogador A"
                              />
                              <Input
                                value={editingTeam.player_b}
                                onChange={(e) => setEditingTeam({ ...editingTeam, player_b: e.target.value })}
                                className="bg-white/10 border-white/20 text-white"
                                placeholder="Jogador B"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveTeamEdit} className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300">
                                <Save size={16} className="mr-1" /> Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingTeam(null)} className="border-white/30 text-white hover:bg-white/15">
                                <X size={16} className="mr-1" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div className="font-semibold">{team.name}</div>
                              <div className="text-xs text-white/70">{team.player_a} / {team.player_b}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-500/90 text-white hover:bg-blue-600"
                                onClick={() => setEditingTeam({ id: team.id, name: team.name, player_a: team.player_a, player_b: team.player_b })}
                              >
                                <Edit2 size={16} className="mr-1" />
                                Editar
                              </Button>
                              <ConfirmDialog
                                title="Excluir dupla"
                                description="Esta ação removerá a dupla e todos os jogos associados. Deseja continuar?"
                                confirmText="Excluir dupla"
                                destructive
                                trigger={
                                  <Button size="sm" className="bg-red-500/90 text-white hover:bg-red-600">
                                    Excluir
                                  </Button>
                                }
                                onConfirm={async () => {
                                  await supabase
                                    .from('matches')
                                    .delete()
                                    .eq('tournament_id', tournament.id)
                                    .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
                                  await supabase.from('tournament_teams').delete().eq('tournament_id', tournament.id).eq('team_id', team.id)
                                  await supabase.from('teams').delete().eq('id', team.id)
                                  await loadTournamentTeams()
                                  toast({ title: 'Dupla removida' })
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {teams.length === 0 && <p className="text-sm text-white/70">Nenhuma equipe.</p>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input
                      placeholder="Nome da dupla"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Input
                      placeholder="Jogador A"
                      value={teamForm.player_a}
                      onChange={(e) => setTeamForm({ ...teamForm, player_a: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Input
                      placeholder="Jogador B"
                      value={teamForm.player_b}
                      onChange={(e) => setTeamForm({ ...teamForm, player_b: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Button
                      className="bg-yellow-400/90 text-slate-900 hover:bg-yellow-300"
                      onClick={async () => {
                        if (!teamForm.name || !teamForm.player_a || !teamForm.player_b) { toast({ title: 'Preencha a dupla' }); return }
                        const { data: team, error: terr } = await supabase.from('teams').insert({ name: teamForm.name, player_a: teamForm.player_a, player_b: teamForm.player_b }).select('*').single()
                        if (terr) { toast({ title: 'Erro ao criar', description: terr.message }); return }
                        const { error: rerr } = await supabase.from('tournament_teams').insert({ tournament_id: tournament.id, team_id: team.id })
                        if (rerr) { toast({ title: 'Erro ao vincular', description: rerr.message }); return }
                        await loadTournamentTeams()
                        setTeamForm({ name: '', player_a: '', player_b: '' })
                        toast({ title: 'Dupla adicionada' })
                      }}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="mt-0">
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-xl">Jogos</CardTitle>
                  {availablePhases.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/70">Fase:</span>
                      <Select value={currentPhaseFilter} onValueChange={setCurrentPhaseFilter}>
                        <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Selecionar fase" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950/95 text-white border-white/20">
                          {availablePhases.map((phase) => (
                            <SelectItem key={phase} value={phase}>
                              {phase}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {currentPhaseFilter && (
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      onClick={() => handleCheckPhase(currentPhaseFilter)}
                      className="bg-emerald-500/90 text-white hover:bg-emerald-600"
                      size="sm"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Finalizar "{currentPhaseFilter}"
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {matches
                    .filter((m) => !currentPhaseFilter || m.phase === currentPhaseFilter)
                    .map(m => {
                    const a = teams.find(t => t.id === m.team_a_id)
                    const b = teams.find(t => t.id === m.team_b_id)
                    return (
                      <div key={m.id} className="rounded-lg border border-white/15 bg-white/5 p-3">
                        {editingMatch?.id === m.id ? (
                          <div className="space-y-3">
                            <div className="font-semibold text-white">{a?.name || 'Equipe A'} vs {b?.name || 'Equipe B'}</div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-1">
                                <label className="text-xs text-white/70">Horário agendado</label>
                                <Input
                                  type="datetime-local"
                                  value={editingMatch.scheduled_at}
                                  onChange={(e) => setEditingMatch({ ...editingMatch, scheduled_at: e.target.value })}
                                  className="bg-white/10 border-white/20 text-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-white/70">Quadra</label>
                                <Input
                                  value={editingMatch.court}
                                  onChange={(e) => setEditingMatch({ ...editingMatch, court: e.target.value })}
                                  className="bg-white/10 border-white/20 text-white"
                                  placeholder="Ex: 1, A, Central"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-white/70">Fase</label>
                                <Input
                                  value={editingMatch.phase}
                                  onChange={(e) => setEditingMatch({ ...editingMatch, phase: e.target.value })}
                                  className="bg-white/10 border-white/20 text-white"
                                  placeholder="Ex: Fase de Grupos"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveMatchEdit} className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300">
                                <Save size={16} className="mr-1" /> Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingMatch(null)} className="border-white/30 text-white hover:bg-white/15">
                                <X size={16} className="mr-1" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                              <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                                <div className="flex items-center gap-2">
                                  <Clock size={16} className="text-white/60" />
                                  {formatDateTimePtBr(m.scheduled_at, { fallback: 'Sem horário agendado' })}
                                </div>
                                <Badge variant="outline" className="border-white/40 text-white">
                                  {m.phase || 'Jogo'}
                                </Badge>
                                {m.court && (
                                  <Badge variant="outline" className="border-white/40 text-white">
                                    Quadra {m.court}
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold">{a?.name || 'Equipe A'} vs {b?.name || 'Equipe B'}</div>
                                <div className="text-xs uppercase tracking-wide text-white/70">{m.status}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Select 
                                value={m.status || 'scheduled'} 
                                onValueChange={async (v) => {
                                  await supabase.from('matches').update({ status: v }).eq('id', m.id)
                                  setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: v } : x))
                                }}
                                disabled={m.status === 'completed' && !isAdminSistema}
                              >
                                <SelectTrigger className="w-full bg-white/10 border-white/30 text-white sm:w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                                  <SelectItem value="scheduled">Pendente</SelectItem>
                                  <SelectItem value="in_progress">Em andamento</SelectItem>
                                  <SelectItem value="completed">Finalizado</SelectItem>
                                  <SelectItem value="canceled">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                              {(m.status !== 'completed' || isAdminSistema) && (
                                <Button
                                  size="sm"
                                  className="bg-amber-500/90 text-white hover:bg-amber-600"
                                  onClick={() => setEditingMatch({ 
                                    id: m.id, 
                                    scheduled_at: m.scheduled_at ? toDatetimeLocalInputValue(m.scheduled_at) : '', 
                                    court: m.court || '',
                                    phase: m.phase || '',
                                  })}
                                >
                                  <Edit2 size={16} className="mr-1" />
                                  Editar
                                </Button>
                              )}
                              <Link to={`/referee/${m.id}`}>
                                <Button size="sm" className="bg-blue-500/90 text-white hover:bg-blue-600">
                                  Mesa
                                </Button>
                              </Link>
                              <Link to={`/scoreboard/${m.id}`}>
                                <Button size="sm" className="bg-emerald-500/90 text-white hover:bg-emerald-600">
                                  Placar
                                </Button>
                              </Link>
                              <Link to={`/spectator/${m.id}`}>
                                <Button size="sm" className="bg-purple-500/90 text-white hover:bg-purple-600">
                                  Torcida
                                </Button>
                              </Link>
                              <ConfirmDialog
                                title="Excluir jogo"
                                description="Confirme para remover este jogo da tabela. Esta ação não pode ser desfeita."
                                confirmText="Excluir jogo"
                                destructive
                                trigger={
                                  <Button size="sm" className="bg-red-500/90 text-white hover:bg-red-600">
                                    Excluir
                                  </Button>
                                }
                                onConfirm={async () => {
                                  const { error } = await supabase.from('matches').delete().eq('id', m.id)
                                  if (error) {
                                    toast({ title: 'Erro ao excluir jogo', description: error.message })
                                    return
                                  }
                                  setMatches(prev => prev.filter(x => x.id !== m.id))
                                  toast({ title: 'Jogo removido' })
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {matches.length === 0 && <p className="text-sm text-white/70">Nenhum jogo.</p>}

                  <div className="grid gap-3 pt-2 md:grid-cols-6">
                    <TeamSearchSelect
                      value={matchForm.teamA}
                      onChange={(value) => setMatchForm({ ...matchForm, teamA: value })}
                      placeholder="Equipe A"
                      options={teamOptions}
                    />
                    <TeamSearchSelect
                      value={matchForm.teamB}
                      onChange={(value) => setMatchForm({ ...matchForm, teamB: value })}
                      placeholder="Equipe B"
                      options={teamOptions}
                    />
                    <Input
                      type="text"
                      value={matchForm.court}
                      onChange={(e) => setMatchForm({ ...matchForm, court: e.target.value })}
                      placeholder="Quadra"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Input
                      type="datetime-local"
                      value={matchForm.scheduled_at}
                      onChange={(e) => setMatchForm({ ...matchForm, scheduled_at: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Select
                      value={matchForm.mode}
                      onValueChange={(value) => setMatchForm({ ...matchForm, mode: value as MatchModeValue })}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Modo de disputa" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                        {MATCH_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300"
                      onClick={async () => {
                        if (!matchForm.teamA || !matchForm.teamB || matchForm.teamA === matchForm.teamB) { toast({ title: 'Selecione equipes diferentes' }); return }
                        const selectedMode = MATCH_MODES.find((mode) => mode.value === matchForm.mode) ?? MATCH_MODES[0]
                        const { error } = await supabase.from('matches').insert([{
                          tournament_id: tournament.id,
                          team_a_id: matchForm.teamA,
                          team_b_id: matchForm.teamB,
                          scheduled_at: matchForm.scheduled_at || null,
                          court: matchForm.court || null,
                          status: 'scheduled',
                          best_of: selectedMode.bestOf,
                          points_per_set: [...selectedMode.pointsPerSet],
                          side_switch_sum: [...selectedMode.sideSwitchSum],
                        }])
                        if (error) { toast({ title: 'Erro ao criar jogo', description: error.message }); return }
                        const { data: m } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id).order('scheduled_at', { ascending: true })
                        setMatches(m || [])
                        setMatchForm({ teamA: '', teamB: '', scheduled_at: '', court: '', mode: MATCH_MODES[0].value })
                        toast({ title: 'Jogo criado' })
                      }}
                    >
                      Criar jogo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-0">
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">Tabela de Classificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {standingsByGroup.length === 0 && eliminationSummaries.length === 0 ? (
                  <p className="text-sm text-white/70">Nenhuma equipe ou partida registrada até o momento.</p>
                ) : (
                  <div className="space-y-10">
                    {standingsByGroup.map((group) => {
                      const groupHasMatches = group.hasResults

                      return (
                        <div key={group.key} className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-white">{group.label}</h3>
                            <Badge variant="outline" className="border-white/30 text-white/80">
                              {group.standings.length} {group.standings.length === 1 ? 'dupla' : 'duplas'}
                            </Badge>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10 text-sm">
                              <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-white/60">
                                <tr>
                                  <th className="px-3 py-2 text-left">#</th>
                                  <th className="px-3 py-2 text-left">Equipe</th>
                                  <th className="px-3 py-2 text-center">J</th>
                                  <th className="px-3 py-2 text-center">V</th>
                                  <th className="px-3 py-2 text-center">D</th>
                                  <th className="px-3 py-2 text-center">S+</th>
                                  <th className="px-3 py-2 text-center">S-</th>
                                  <th className="px-3 py-2 text-center">SΔ</th>
                                  <th className="px-3 py-2 text-center">P+</th>
                                  <th className="px-3 py-2 text-center">P-</th>
                                  <th className="px-3 py-2 text-center">PΔ</th>
                                  <th className="px-3 py-2 text-center">Pts</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-white/80">
                                {group.standings.map((entry, index) => {
                                  const setBalance = entry.setsWon - entry.setsLost
                                  const pointBalance = entry.pointsFor - entry.pointsAgainst

                                  return (
                                    <tr key={entry.teamId} className="transition hover:bg-white/5">
                                      <td className="px-3 py-2 text-left text-white/60">{index + 1}</td>
                                      <td className="px-3 py-2 font-medium text-white">{entry.teamName}</td>
                                      <td className="px-3 py-2 text-center">{entry.matchesPlayed}</td>
                                      <td className="px-3 py-2 text-center text-emerald-200">{entry.wins}</td>
                                      <td className="px-3 py-2 text-center text-rose-200">{entry.losses}</td>
                                      <td className="px-3 py-2 text-center">{entry.setsWon}</td>
                                      <td className="px-3 py-2 text-center">{entry.setsLost}</td>
                                      <td
                                        className={`px-3 py-2 text-center ${
                                          setBalance >= 0 ? 'text-emerald-200' : 'text-rose-200'
                                        }`}
                                      >
                                        {setBalance}
                                      </td>
                                      <td className="px-3 py-2 text-center">{entry.pointsFor}</td>
                                      <td className="px-3 py-2 text-center">{entry.pointsAgainst}</td>
                                      <td
                                        className={`px-3 py-2 text-center ${
                                          pointBalance >= 0 ? 'text-emerald-200' : 'text-rose-200'
                                        }`}
                                      >
                                        {pointBalance}
                                      </td>
                                      <td className="px-3 py-2 text-center font-semibold text-yellow-200">
                                        {entry.matchPoints}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          {!groupHasMatches && (
                            <p className="text-xs text-white/60">
                              Nenhum jogo finalizado para este grupo ainda. Assim que os resultados forem registrados, a classificação será atualizada automaticamente.
                            </p>
                          )}
                        </div>
                      )
                    })}

                    {eliminationSummaries.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">Chave eliminatória</h3>
                          <Badge variant="outline" className="border-white/30 text-white/80">
                            {eliminationSummaries.reduce((total, phase) => total + phase.matches.length, 0)} jogos
                          </Badge>
                        </div>
                        <div className="space-y-6">
                          {eliminationSummaries.map((phase) => (
                            <div key={phase.phase} className="space-y-3">
                              <h4 className="text-base font-semibold text-white/90">{phase.phase}</h4>
                              <div className="space-y-2">
                                {phase.matches.map((match) => (
                                  <div
                                    key={match.id}
                                    className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-medium">{match.pairing}</span>
                                      <span className="text-white/80">{match.result}</span>
                                    </div>
                                    {match.metadata && (
                                      <p className="mt-2 text-xs text-white/60">{match.metadata}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">Configurações do Torneio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tournament Logo */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon size={20} />
                    Logo do Torneio
                  </h3>
                  {logoUrl && (
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-white/20">
                      <img src={logoUrl} alt="Logo do torneio" className="w-full h-full object-contain bg-white/5" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="URL da logo do torneio"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Button onClick={handleSaveLogo} className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300">
                      <Upload size={16} className="mr-2" />
                      Salvar
                    </Button>
                  </div>
                </div>

                {/* Sponsor Logos */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon size={20} />
                    Patrocinadores
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sponsorLogos.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="w-full h-24 rounded-lg overflow-hidden border border-white/20">
                          <img src={url} alt={`Patrocinador ${index + 1}`} className="w-full h-full object-contain bg-white/5" />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/90 border-red-400 text-white hover:bg-red-600"
                          onClick={() => handleRemoveSponsor(index)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newSponsorUrl}
                      onChange={(e) => setNewSponsorUrl(e.target.value)}
                      placeholder="URL da logo do patrocinador"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Button onClick={handleAddSponsor} className="bg-emerald-400/90 text-slate-900 hover:bg-emerald-300">
                      <Upload size={16} className="mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {/* Tournament Info */}
                <div className="space-y-3 pt-6 border-t border-white/20">
                  <h3 className="text-lg font-semibold">Informações do Torneio</h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/70">Local:</span>
                      <span className="font-semibold text-right">{tournament.location || 'Não definido'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Início:</span>
                      <span className="font-semibold">{formattedStartDateDetailed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Fim:</span>
                      <span className="font-semibold">{formattedEndDateDetailed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Status:</span>
                      <span className="font-semibold text-right capitalize">{tournament.status || 'Em definição'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Modalidade:</span>
                      <span className="font-semibold">{tournament.modality || 'Não definida'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Categoria:</span>
                      <span className="font-semibold">{tournament.category || 'Não definida'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Estatísticas:</span>
                      <Badge variant={tournament.has_statistics ? 'default' : 'outline'} className="border-white/40">
                        {tournament.has_statistics ? 'Ativadas' : 'Desativadas'}
                      </Badge>
                    </div>
                  </div>
                  {tournamentConfig && (
                    <div className="space-y-3 pt-4">
                      <h4 className="text-base font-semibold">Formato configurado</h4>
                      <div className="grid gap-2 text-sm">
                        {selectedFormatName && (
                          <div className="flex justify-between">
                            <span className="text-white/70">Formato:</span>
                            <span className="font-semibold text-right">{selectedFormatName}</span>
                          </div>
                        )}
                        {typeof tournamentConfig.includeThirdPlace === 'boolean' && (
                          <div className="flex justify-between">
                            <span className="text-white/70">Disputa de 3º lugar:</span>
                            <Badge variant={tournamentConfig.includeThirdPlace ? 'default' : 'outline'} className="border-white/40">
                              {tournamentConfig.includeThirdPlace ? 'Sim' : 'Não'}
                            </Badge>
                          </div>
                        )}
                        {tournamentConfig.matchFormats && (
                          <div className="space-y-2">
                            <span className="text-white/70">Formato das partidas:</span>
                            <div className="grid gap-1 text-xs sm:grid-cols-2">
                                {Object.entries(tournamentConfig.matchFormats).map(([phase, value]) => {
                                if (!value) return null
                                return (
                                  <div key={phase} className="flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2">
                                      <span className="text-white/70">{PHASE_LABELS[phase] || phase}</span>
                                      <span className="font-semibold text-right text-white">{MATCH_FORMAT_LABELS[value as MatchFormatOption]}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <span className="text-white/70">Critérios de desempate:</span>
                          <div className="flex flex-wrap gap-2">
                            {tieBreakerOrder.map((criterion) => (
                              <Badge key={criterion} variant="outline" className="border-white/30 text-white">
                                {TIE_BREAKER_LABELS[criterion] ?? criterion}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {tournamentConfig?.formatId && (
                    <div className="space-y-3 pt-6 border-t border-white/20">
                      <h4 className="text-base font-semibold">Critérios de Confronto</h4>
                      <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                        <TournamentBracketCriteria formatId={tournamentConfig.formatId} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Confirmação de Finalização de Fase */}
      <Dialog open={showAdvancePhaseDialog} onOpenChange={setShowAdvancePhaseDialog}>
        <DialogContent className="bg-slate-900/95 border border-white/20 text-white backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Play className="h-5 w-5 text-emerald-400" />
              Finalizar Fase
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {phaseCheckResult?.currentPhase}
            </DialogDescription>
          </DialogHeader>

          {phaseCheckResult && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Total de jogos:</span>
                  <span className="font-semibold">{phaseCheckResult.totalMatches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Jogos finalizados:</span>
                  <span className="font-semibold text-emerald-400">
                    {phaseCheckResult.completedMatches}
                  </span>
                </div>
                {phaseCheckResult.pendingMatches.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Jogos pendentes:</span>
                    <span className="font-semibold text-amber-400">
                      {phaseCheckResult.pendingMatches.length}
                    </span>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'rounded-lg p-4 flex items-start gap-3',
                  phaseCheckResult.canAdvance
                    ? 'bg-emerald-500/10 border border-emerald-400/30'
                    : 'bg-amber-500/10 border border-amber-400/30',
                )}
              >
                <AlertCircle
                  className={cn(
                    'h-5 w-5 flex-shrink-0 mt-0.5',
                    phaseCheckResult.canAdvance ? 'text-emerald-400' : 'text-amber-400',
                  )}
                />
                <div className="space-y-2 flex-1">
                  <p className={cn('text-sm', phaseCheckResult.canAdvance ? 'text-emerald-100' : 'text-amber-100')}>
                    {phaseCheckResult.message}
                  </p>
                  {phaseCheckResult.canAdvance && (
                    <p className="text-xs text-white/70">
                      Ao confirmar, você poderá definir manualmente os confrontos da próxima fase, seguindo
                      os critérios de cruzamento configurados para o torneio.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAdvancePhaseDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            {phaseCheckResult?.canAdvance && (
              <Button
                onClick={handlePrepareMatchSetup}
                className="bg-emerald-500/90 text-white hover:bg-emerald-600"
              >
                Definir confrontos
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de configuração manual de confrontos */}
      <Dialog
        open={showMatchSetupDialog}
        onOpenChange={(open) => {
          setShowMatchSetupDialog(open)
          if (!open) {
            setMatchSetupError(null)
          }
        }}
      >
        <DialogContent className="bg-slate-900/95 border border-white/15 text-white backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Configurar {matchSetupPhase}</DialogTitle>
            <DialogDescription className="text-white/70">
              Defina manualmente os confrontos desta fase seguindo o critério oficial.
            </DialogDescription>
          </DialogHeader>

          {nextPhaseSection && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <p className="font-semibold text-white mb-2">Critério de confrontos</p>
              <ul className="space-y-1">
                {nextPhaseSection.matches.map((match) => (
                  <li key={`${nextPhaseSection.phase}-${match.label}`}>
                    <span className="font-semibold text-white">{match.label}:</span> {match.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {matchSetupEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">{entry.label}</p>
                  <p className="text-xs text-white/70">{entry.description || 'Defina os participantes deste confronto.'}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-white/70">Equipe A</Label>
                    <Select value={entry.teamAId} onValueChange={(value) => updateMatchSetupEntry(entry.id, { teamAId: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione a equipe A" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950/90 text-white">
                        {teamOptions.map((option) => (
                          <SelectItem key={`${entry.id}-teamA-${option.value}`} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-white/70">Equipe B</Label>
                    <Select value={entry.teamBId} onValueChange={(value) => updateMatchSetupEntry(entry.id, { teamBId: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione a equipe B" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950/90 text-white">
                        {teamOptions.map((option) => (
                          <SelectItem key={`${entry.id}-teamB-${option.value}`} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-white/70">Melhor de</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={entry.bestOf}
                      onChange={(event) =>
                        updateMatchSetupEntry(entry.id, { bestOf: Number(event.target.value) || 0 })
                      }
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-xs text-white/70">Pontos por set</Label>
                    <Input
                      value={entry.pointsText}
                      onChange={(event) => updateMatchSetupEntry(entry.id, { pointsText: event.target.value })}
                      placeholder="Ex.: 21, 21, 15"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <p className="text-[10px] text-white/60">Separe por vírgulas.</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-xs text-white/70">Troca de quadra</Label>
                    <Input
                      value={entry.sideSwitchText}
                      onChange={(event) => updateMatchSetupEntry(entry.id, { sideSwitchText: event.target.value })}
                      placeholder="Ex.: 7, 7, 5"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <p className="text-[10px] text-white/60">Valores acumulados por set.</p>
                  </div>
                </div>
                <p className="text-[11px] text-white/50">Fase: {entry.phase}</p>
              </div>
            ))}
          </div>

          {matchSetupError && <p className="text-sm text-rose-300">{matchSetupError}</p>}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setShowMatchSetupDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveMatchSetup}
              disabled={isSavingMatchSetup || matchSetupEntries.length === 0}
              className="bg-emerald-500/90 text-white hover:bg-emerald-600"
            >
              {isSavingMatchSetup ? 'Salvando...' : 'Salvar confrontos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
