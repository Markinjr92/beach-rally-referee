import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Check, ChevronsUpDown, Upload, Image as ImageIcon, Edit2, Save, X } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { formatDateShortPtBr, formatDateTimePtBr, toDatetimeLocalInputValue } from '@/utils/date'
import {
  GroupAssignment,
  GroupStanding,
  buildGroupAssignments,
  computeStandingsByGroup,
} from '@/utils/tournamentStandings'
import { availableTournamentFormats, defaultTieBreakerOrder } from '@/lib/tournament'
import type { TournamentFormatId, TieBreakerCriterion } from '@/types/volleyball'

type Tournament = Tables<'tournaments'>
type Team = Tables<'teams'>
type Match = Tables<'matches'>
type MatchScore = Tables<'match_scores'>

type TeamOption = { value: string; label: string }

const MATCH_MODES = [
  {
    value: 'best3_21_15',
    label: 'Melhor de 3 sets de 21 e desempate de 15',
    bestOf: 3,
    pointsPerSet: [21, 21, 15],
  },
  {
    value: 'single_21',
    label: '1 set de 21',
    bestOf: 1,
    pointsPerSet: [21],
  },
  {
    value: 'best3_15_10',
    label: 'Melhor de 3 sets de 15 e desempate de 10',
    bestOf: 3,
    pointsPerSet: [15, 15, 10],
  },
  {
    value: 'best3_15_15',
    label: 'Melhor de 3 sets de 15 e desempate de 15',
    bestOf: 3,
    pointsPerSet: [15, 15, 15],
  },
] as const

type MatchModeValue = typeof MATCH_MODES[number]['value']

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

type EditingTeam = {
  id: string
  name: string
  player_a: string
  player_b: string
} | null

type MatchFormatOption = 'melhorDe1' | 'melhorDe3'

type StoredTournamentConfig = {
  formatId?: TournamentFormatId
  tieBreakerOrder?: TieBreakerCriterion[]
  includeThirdPlace?: boolean
  matchFormats?: Partial<Record<'group' | 'knockout' | 'thirdPlace', MatchFormatOption>>
}

type TournamentTeamRecord = {
  team_id: string
  group_label: string | null
  teams: Team | null
}

const MATCH_FORMAT_LABELS: Record<MatchFormatOption, string> = {
  melhorDe3: 'Melhor de 3 sets (21/21/15)',
  melhorDe1: 'Set único de 21 pontos',
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
  const [logoUrl, setLogoUrl] = useState('')
  const [sponsorLogos, setSponsorLogos] = useState<string[]>([])
  const [newSponsorUrl, setNewSponsorUrl] = useState('')
  const [teamGroups, setTeamGroups] = useState<Record<string, string | null>>({})
  const [matchScores, setMatchScores] = useState<MatchScore[]>([])
  const [tournamentConfig, setTournamentConfig] = useState<StoredTournamentConfig | null>(null)

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
    if (!tournamentId) return
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(`tournament:${tournamentId}:config`)
      if (!stored) {
        setTournamentConfig(null)
        return
      }
      const parsed = JSON.parse(stored) as StoredTournamentConfig
      setTournamentConfig(parsed)
    } catch (error) {
      console.error('Falha ao carregar configuração local do torneio', error)
      setTournamentConfig(null)
    }
  }, [tournamentId])

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

  const teamOptions = useMemo(() => teams.map(t => ({ value: t.id, label: t.name })), [teams])

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

  const groupAssignments = useMemo<GroupAssignment[]>(
    () => buildGroupAssignments(teams, teamGroups),
    [teams, teamGroups],
  )

  const standingsByGroup: GroupStanding[] = useMemo(
    () =>
      computeStandingsByGroup({
        matches,
        scoresByMatch,
        groupAssignments,
        teamNameMap,
      }),
    [groupAssignments, matches, scoresByMatch, teamNameMap],
  )

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
                                variant="outline"
                                className="border-white/30 text-white hover:bg-white/15"
                                onClick={() => setEditingTeam({ id: team.id, name: team.name, player_a: team.player_a, player_b: team.player_b })}
                              >
                                <Edit2 size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/30 text-white hover:bg-white/15"
                                onClick={async () => {
                                  await supabase.from('matches').delete().eq('tournament_id', tournament.id).or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
                                  await supabase.from('tournament_teams').delete().eq('tournament_id', tournament.id).eq('team_id', team.id)
                                  await supabase.from('teams').delete().eq('id', team.id)
                                  await loadTournamentTeams()
                                  toast({ title: 'Dupla removida' })
                                }}
                              >
                                Excluir
                              </Button>
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
                <CardTitle className="text-xl">Jogos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {matches.map(m => {
                    const a = teams.find(t => t.id === m.team_a_id)
                    const b = teams.find(t => t.id === m.team_b_id)
                    return (
                      <div key={m.id} className="flex flex-col gap-3 rounded-lg border border-white/15 bg-white/5 p-3 md:flex-row md:items-center md:justify-between">
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
                          <Select value={m.status || 'scheduled'} onValueChange={async (v) => {
                            await supabase.from('matches').update({ status: v }).eq('id', m.id)
                            setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: v } : x))
                          }}>
                            <SelectTrigger className="w-full bg-white/10 border-white/30 text-white sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                              <SelectItem value="scheduled">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em andamento</SelectItem>
                              <SelectItem value="completed">Finalizado</SelectItem>
                              <SelectItem value="canceled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Button
                            size="sm"
                            className="bg-red-500/90 text-white hover:bg-red-600"
                            onClick={async () => {
                              if (!confirm('Remover este jogo?')) return
                              const { error } = await supabase.from('matches').delete().eq('id', m.id)
                              if (error) { toast({ title: 'Erro ao excluir jogo', description: error.message }); return }
                              setMatches(prev => prev.filter(x => x.id !== m.id))
                              toast({ title: 'Jogo removido' })
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
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
                {standingsByGroup.length === 0 ? (
                  <p className="text-sm text-white/70">Nenhuma equipe ou partida registrada até o momento.</p>
                ) : (
                  standingsByGroup.map((group) => {
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
                            <thead>
                              <tr className="text-left text-white/70">
                                <th className="px-4 py-3 font-medium">Posição</th>
                                <th className="px-4 py-3 font-medium">Dupla</th>
                                <th className="px-4 py-3 font-medium text-center">PJ</th>
                                <th className="px-4 py-3 font-medium text-center">V</th>
                                <th className="px-4 py-3 font-medium text-center">D</th>
                                <th className="px-4 py-3 font-medium text-center">Sets</th>
                                <th className="px-4 py-3 font-medium text-center">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.standings.map((entry, index) => (
                                <tr key={entry.teamId} className="border-b border-white/10 hover:bg-white/5">
                                  <td className="px-4 py-3 font-bold text-white">{index + 1}</td>
                                  <td className="px-4 py-3">{entry.teamName}</td>
                                  <td className="px-4 py-3 text-center text-white/80">{entry.matchesPlayed}</td>
                                  <td className="px-4 py-3 text-center text-emerald-300">{entry.wins}</td>
                                  <td className="px-4 py-3 text-center text-rose-300">{entry.losses}</td>
                                  <td className="px-4 py-3 text-center text-white/80">
                                    {entry.setsWon}
                                    <span className="text-white/50"> / </span>
                                    {entry.setsLost}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-white">{entry.matchPoints}</td>
                                </tr>
                              ))}
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
                  })
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
                              {(['group', 'knockout', 'thirdPlace'] as const).map((phase) => {
                                const value = tournamentConfig.matchFormats?.[phase]
                                if (!value) return null
                                const label =
                                  phase === 'group'
                                    ? 'Fase de grupos'
                                    : phase === 'knockout'
                                    ? 'Eliminatória'
                                    : 'Disputa de 3º'
                                return (
                                  <div key={phase} className="flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2">
                                    <span className="text-white/70">{label}</span>
                                    <span className="font-semibold text-right text-white">{MATCH_FORMAT_LABELS[value]}</span>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
