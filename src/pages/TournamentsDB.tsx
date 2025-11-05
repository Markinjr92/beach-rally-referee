import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Calendar, MapPin, Plus, Trophy, GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Tables, TablesInsert } from "@/integrations/supabase/types"
import { cn, formatDateToISO, normalizeString } from "@/lib/utils"
import { formatDateShortPtBr } from "@/utils/date"
import { useAuth } from "@/hooks/useAuth"
import { useUserRoles } from "@/hooks/useUserRoles"
import {
  availableTournamentFormats,
  buildTournamentRegulationHtml,
  defaultTieBreakerOrder,
  generateTournamentStructure,
} from "@/lib/tournament"
import { Tournament as TournamentType, TournamentFormatId, TournamentTeam, TieBreakerCriterion } from "@/types/volleyball"

type Tournament = Tables<'tournaments'>

type MatchFormatOption = 'melhorDe1' | 'melhorDe3' | 'melhorDe3_15' | 'melhorDe3_15_10'

interface CreateTournamentFormState {
  name: string
  location: string
  start: string
  end: string
  category: string
  modality: string
  hasStatistics: boolean
  formatId: TournamentFormatId
  includeThirdPlace: boolean
  matchFormats: {
    groups?: MatchFormatOption
    quarterfinals?: MatchFormatOption
    semifinals?: MatchFormatOption
    final?: MatchFormatOption
    thirdPlace?: MatchFormatOption
  }
  tieBreakerOrder: TieBreakerCriterion[]
}

export default function TournamentsDB() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateTournamentFormState>({
    name: "",
    location: "",
    start: "",
    end: "",
    category: "",
    modality: "",
    hasStatistics: true,
    formatId: "groups_and_knockout",
    includeThirdPlace: true,
    matchFormats: {
      groups: "melhorDe3",
      quarterfinals: "melhorDe3",
      semifinals: "melhorDe3",
      final: "melhorDe3",
      thirdPlace: "melhorDe3",
    },
    tieBreakerOrder: [...defaultTieBreakerOrder],
  })
  const [currentStep, setCurrentStep] = useState(0)
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading)
  const canManageTournaments = useMemo(
    () => roles.includes("admin_sistema") || roles.includes("organizador"),
    [roles],
  )

  const availableFormats = useMemo(
    () => Object.values(availableTournamentFormats),
    [],
  )

  const tieBreakerOptions = useMemo(
    () => [
      {
        value: "head_to_head" as TieBreakerCriterion,
        label: "Confronto direto (apenas 2 equipes)",
      },
      {
        value: "sets_average_inner" as TieBreakerCriterion,
        label: "Average de sets entre empatadas",
      },
      {
        value: "points_average_inner" as TieBreakerCriterion,
        label: "Average de pontos entre empatadas",
      },
      {
        value: "sets_average_global" as TieBreakerCriterion,
        label: "Average de sets na fase",
      },
      {
        value: "points_average_global" as TieBreakerCriterion,
        label: "Average de pontos na fase",
      },
      { value: "random_draw" as TieBreakerCriterion, label: "Sorteio" },
    ],
    [],
  )

  const handleTieBreakerChange = (index: number, value: TieBreakerCriterion) => {
    setForm((prev) => {
      const next = [...prev.tieBreakerOrder]
      const existingIndex = next.findIndex((criterion) => criterion === value)
      if (existingIndex !== -1 && existingIndex !== index) {
        next[existingIndex] = next[index]
      }
      next[index] = value
      return { ...prev, tieBreakerOrder: next }
    })
  }

  const handleTieBreakerDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleTieBreakerDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTieBreakerDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    
    if (dragIndex === dropIndex) return
    
    setForm((prev) => {
      const next = [...prev.tieBreakerOrder]
      const [draggedItem] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, draggedItem)
      return { ...prev, tieBreakerOrder: next }
    })
  }

  const matchFormatPresets = useMemo(
    () =>
      ({
        melhorDe3: {
          pointsPerSet: [21, 21, 15],
          sideSwitchSum: [7, 7, 5],
          teamTimeoutsPerSet: 2,
        },
        melhorDe1: {
          pointsPerSet: [21],
          sideSwitchSum: [7],
          teamTimeoutsPerSet: 1,
        },
        melhorDe3_15: {
          pointsPerSet: [15, 15, 15],
          sideSwitchSum: [5, 5, 5],
          teamTimeoutsPerSet: 2,
        },
        melhorDe3_15_10: {
          pointsPerSet: [15, 15, 10],
          sideSwitchSum: [5, 5, 5],
          teamTimeoutsPerSet: 2,
        },
      }) as const,
    [],
  )

  // Get phases that need match format configuration for each tournament format
  const getFormatPhases = (formatId: TournamentFormatId): Array<{ key: keyof CreateTournamentFormState['matchFormats']; label: string }> => {
    const phasesByFormat: Record<TournamentFormatId, Array<{ key: keyof CreateTournamentFormState['matchFormats']; label: string }>> = {
      groups_and_knockout: [
        { key: 'groups', label: 'Fase de Grupos' },
        { key: 'quarterfinals', label: 'Quartas de Final' },
        { key: 'semifinals', label: 'Semifinais' },
        { key: 'final', label: 'Final' },
      ],
      '3_groups_quarterfinals': [
        { key: 'groups', label: 'Fase de Grupos' },
        { key: 'quarterfinals', label: 'Quartas de Final' },
        { key: 'semifinals', label: 'Semifinais' },
        { key: 'final', label: 'Final' },
      ],
      global_semis: [
        { key: 'groups', label: 'Fase de Grupos' },
        { key: 'semifinals', label: 'Semifinais' },
        { key: 'final', label: 'Final' },
      ],
      series_gold_silver: [
        { key: 'groups', label: 'Fase de Grupos' },
        { key: 'semifinals', label: 'Semifinais (Ouro/Prata)' },
        { key: 'final', label: 'Finais (Ouro/Prata)' },
      ],
      single_elimination: [
        { key: 'quarterfinals', label: 'Quartas de Final' },
        { key: 'semifinals', label: 'Semifinais' },
        { key: 'final', label: 'Final' },
      ],
      double_elimination: [
        { key: 'quarterfinals', label: 'Chave de Vencedores/Repescagem' },
        { key: 'final', label: 'Grande Final' },
      ],
    }
    return phasesByFormat[formatId] || []
  }

  const initializeTournamentStructure = async (tournament: Tables<'tournaments'>) => {
    try {
      const placeholderTeams: TablesInsert<'teams'>[] = Array.from({ length: 12 }, (_, index) => ({
        name: `Dupla Seed ${index + 1}`,
        player_a: `Atleta ${index + 1}A`,
        player_b: `Atleta ${index + 1}B`,
      }))

      const { data: createdTeams, error: insertTeamsError } = await supabase
        .from('teams')
        .insert(placeholderTeams)
        .select()

      if (insertTeamsError) throw insertTeamsError
      if (!createdTeams || createdTeams.length !== placeholderTeams.length) {
        throw new Error('Falha ao registrar as duplas placeholder do torneio.')
      }

      const tournamentTeamsPayload: TablesInsert<'tournament_teams'>[] = createdTeams.map((team, index) => ({
        tournament_id: tournament.id,
        team_id: team.id,
        seed: index + 1,
      }))

      const { data: createdTournamentTeams, error: insertTournamentTeamsError } = await supabase
        .from('tournament_teams')
        .insert(tournamentTeamsPayload)
        .select()

      if (insertTournamentTeamsError) throw insertTournamentTeamsError
      if (!createdTournamentTeams) {
        throw new Error('Falha ao atrelar as duplas ao torneio recém criado.')
      }

      const registeredTeams: TournamentTeam[] = createdTournamentTeams.map((entry, index) => ({
        id: entry.id,
        seed: entry.seed ?? index + 1,
        team: {
          name: createdTeams[index]?.name ?? `Seed ${index + 1}`,
          players: [
            { name: createdTeams[index]?.player_a ?? 'A definir', number: 1 },
            { name: createdTeams[index]?.player_b ?? 'A definir', number: 2 },
          ],
        },
      }))

      const formatId = form.formatId
      // Get presets for each phase based on user configuration
      const getPreset = (formatOption: MatchFormatOption | undefined) => {
        const defaultFormat = 'melhorDe3'
        return matchFormatPresets[formatOption || defaultFormat]
      }
      
      const groupPreset = getPreset(form.matchFormats.groups)
      const quarterfinalsPreset = getPreset(form.matchFormats.quarterfinals)
      const semifinalsPreset = getPreset(form.matchFormats.semifinals)
      const finalPreset = getPreset(form.matchFormats.final)
      const thirdPlacePreset = getPreset(form.matchFormats.thirdPlace)

      const structure = generateTournamentStructure({
        tournamentId: tournament.id,
        formatId,
        teams: registeredTeams,
        includeThirdPlaceMatch: form.includeThirdPlace,
        baseGameConfig: {
          category: form.category || 'Misto',
          modality: (form.modality as 'dupla' | 'quarteto') || 'dupla',
          hasStatistics: form.hasStatistics,
          pointsPerSet: [...finalPreset.pointsPerSet],
          sideSwitchSum: [...finalPreset.sideSwitchSum],
          teamTimeoutsPerSet: finalPreset.teamTimeoutsPerSet,
        },
        phaseConfigs: {
          group: {
            pointsPerSet: [...groupPreset.pointsPerSet],
            sideSwitchSum: [...groupPreset.sideSwitchSum],
            teamTimeoutsPerSet: groupPreset.teamTimeoutsPerSet,
          },
          knockout: {
            pointsPerSet: [...finalPreset.pointsPerSet],
            sideSwitchSum: [...finalPreset.sideSwitchSum],
            teamTimeoutsPerSet: finalPreset.teamTimeoutsPerSet,
          },
          thirdPlace: {
            pointsPerSet: [...thirdPlacePreset.pointsPerSet],
            sideSwitchSum: [...thirdPlacePreset.sideSwitchSum],
            teamTimeoutsPerSet: thirdPlacePreset.teamTimeoutsPerSet,
          },
        },
      })

      const teamMap = new Map(
        createdTournamentTeams.map((entry, index) => [entry.id, createdTeams[index]?.id]),
      )

      const groupAssignments = structure.groups.flatMap((group) =>
        group.teamIds.map((teamId) => ({ teamId, label: group.name })),
      )

      if (groupAssignments.length) {
        await Promise.all(
          groupAssignments.map(({ teamId, label }) =>
            supabase.from('tournament_teams').update({ group_label: label }).eq('id', teamId),
          ),
        )
      }

      const matchesToPersist = structure.matches.filter(
        (match) => match.teamAId && match.teamBId,
      )

      if (matchesToPersist.length) {
        const matchPayload: TablesInsert<'matches'>[] = matchesToPersist
          .map((match) => {
            const teamAId = match.teamAId ? teamMap.get(match.teamAId) : undefined
            const teamBId = match.teamBId ? teamMap.get(match.teamBId) : undefined
            if (!teamAId || !teamBId || !match.phaseName) return null
            return {
              tournament_id: tournament.id,
              team_a_id: teamAId,
              team_b_id: teamBId,
              phase: match.phaseName,
              scheduled_at: match.scheduledAt ?? null,
              status: match.status,
              modality: match.modality,
              points_per_set: match.pointsPerSet,
              side_switch_sum: match.sideSwitchSum,
              best_of: match.pointsPerSet.length,
            } as TablesInsert<'matches'>
          })
          .filter((entry): entry is TablesInsert<'matches'> => entry !== null)

        if (matchPayload.length) {
          const { error: insertMatchesError } = await supabase.from('matches').insert(matchPayload)
          if (insertMatchesError) throw insertMatchesError
        }
      }

      const tournamentForRegulation: TournamentType = {
        id: tournament.id,
        name: tournament.name,
        status: (tournament.status as TournamentType['status']) ?? 'upcoming',
        location: tournament.location ?? 'Local a definir',
        startDate: tournament.start_date ?? '',
        endDate: tournament.end_date ?? '',
        games: [],
        formatId,
        tieBreakerOrder: [...form.tieBreakerOrder],
        teams: registeredTeams,
        phases: structure.phases,
        groups: structure.groups,
        matches: structure.matches,
        includeThirdPlaceMatch: form.includeThirdPlace,
      }

      // Configuration is now persisted in the database via the tournaments table
      // No need for localStorage anymore
    } catch (error) {
      console.error('Falha ao inicializar estrutura do torneio', error)
      toast({
        title: 'Torneio criado, mas com pendências',
        description:
          'Não foi possível gerar automaticamente as chaves e tabelas. Ajuste manualmente na tela de detalhes.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
      if (error) toast({ title: 'Erro ao carregar torneios', description: error.message })
      setTournaments(data || [])
    }
    load()
  }, [toast])

  const createTournament = async () => {
    if (!user) {
      toast({ title: "Faça login para criar um torneio" })
      return
    }
    const trimmedName = normalizeString(form.name)
    if (!trimmedName) {
      toast({ title: "Informe o nome do torneio" })
      return
    }
    if (!canManageTournaments) {
      toast({
        title: "Acesso restrito",
        description: "Solicite permissão ao administrador para criar torneios.",
      })
      return
    }
    if (!form.formatId) {
      toast({ title: "Selecione o formato do torneio" })
      return
    }
    const location = normalizeString(form.location)
    const category = normalizeString(form.category)
    const modality = normalizeString(form.modality)
    const startDateISO = formatDateToISO(form.start)
    const endDateISO = formatDateToISO(form.end)

    const payload: TablesInsert<'tournaments'> = {
      name: trimmedName,
      status: "upcoming",
      has_statistics: !!form.hasStatistics,
      location: location ?? null,
      category: category ?? null,
      modality: modality ?? null,
      start_date: startDateISO ?? null,
      end_date: endDateISO ?? null,
      format_id: form.formatId,
      tie_breaker_order: form.tieBreakerOrder,
      include_third_place: form.includeThirdPlace,
      match_format_groups: form.matchFormats.groups ?? null,
      match_format_quarterfinals: form.matchFormats.quarterfinals ?? null,
      match_format_semifinals: form.matchFormats.semifinals ?? null,
      match_format_final: form.matchFormats.final ?? null,
      match_format_third_place: form.matchFormats.thirdPlace ?? null,
    }

    const { data: createdTournament, error } = await supabase
      .from("tournaments")
      .insert(payload)
      .select("*")
      .single()

    if (error || !createdTournament) {
      console.error("Erro ao criar torneio", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      })
      toast({ title: "Erro ao criar", description: error?.message ?? "Erro desconhecido" })
      return
    }

    await initializeTournamentStructure(createdTournament)

    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
    setTournaments(data || [])
    setOpen(false)
    setCurrentStep(0)
    setForm({
      name: "",
      location: "",
      start: "",
      end: "",
      category: "",
      modality: "",
      hasStatistics: true,
      formatId: "groups_and_knockout",
      includeThirdPlace: true,
      matchFormats: {
        groups: "melhorDe3",
        quarterfinals: "melhorDe3",
        semifinals: "melhorDe3",
        final: "melhorDe3",
        thirdPlace: "melhorDe3",
      },
      tieBreakerOrder: [...defaultTieBreakerOrder],
    })
    toast({ title: "Torneio criado" })
  }

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((tournament) => {
      if (statusFilter === 'completed') return tournament.status === 'completed'
      if (statusFilter === 'all') return true
      return tournament.status !== 'completed'
    })
  }, [statusFilter, tournaments])

  const matchFormatOptions: { value: MatchFormatOption; title: string; description: string }[] = [
    {
      value: 'melhorDe3',
      title: 'Melhor de 3 sets (21/21/15)',
      description: 'Formato tradicional: sets de 21, 21 e 15 pontos.',
    },
    {
      value: 'melhorDe3_15',
      title: 'Melhor de 3 sets (15/15/15)',
      description: 'Formato rápido: todos os sets com 15 pontos.',
    },
    {
      value: 'melhorDe3_15_10',
      title: 'Melhor de 3 sets (15/15/10)',
      description: 'Formato misto: sets de 15, 15 e 10 pontos.',
    },
    {
      value: 'melhorDe1',
      title: 'Set único de 21 pontos',
      description: 'Partida rápida em apenas um set até 21 pontos.',
    },
  ]

  const steps = [
    {
      id: 'basic',
      title: 'Informações básicas',
      description: 'Defina o nome, o local e o período previsto para o torneio.',
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-white">Nome do torneio</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-white/15 border-white/30 text-white placeholder:text-blue-50/70 focus-visible:ring-white/70"
              placeholder="Ex: Campeonato Brasileiro 2024"
            />
            <p className="text-xs text-blue-50/80">
              Esse título aparece nos relatórios oficiais e na mesa do árbitro.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-white">Local</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="bg-white/15 border-white/30 text-white placeholder:text-blue-50/70 focus-visible:ring-white/70"
              placeholder="Ex: Copacabana, Rio de Janeiro"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white">Início</Label>
              <Input
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="bg-white/15 border-white/30 text-white placeholder:text-blue-50/70 focus-visible:ring-white/70"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Fim</Label>
              <Input
                type="date"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="bg-white/15 border-white/30 text-white placeholder:text-blue-50/70 focus-visible:ring-white/70"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'structure',
      title: 'Estrutura e categoria',
      description: 'Escolha quem participa, como será a modalidade e se haverá disputa extra.',
      content: (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white">Categoria</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger className="bg-white/15 border-white/30 text-white focus:ring-white/70 focus:ring-offset-0">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                  <SelectItem value="M" className="focus:bg-white/10 focus:text-white">
                    Masculino
                  </SelectItem>
                  <SelectItem value="F" className="focus:bg-white/10 focus:text-white">
                    Feminino
                  </SelectItem>
                  <SelectItem value="Misto" className="focus:bg-white/10 focus:text-white">
                    Misto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Modalidade</Label>
              <Select value={form.modality} onValueChange={(value) => setForm({ ...form, modality: value })}>
                <SelectTrigger className="bg-white/15 border-white/30 text-white focus:ring-white/70 focus:ring-offset-0">
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                  <SelectItem value="dupla" className="focus:bg-white/10 focus:text-white">
                    Dupla
                  </SelectItem>
                  <SelectItem value="quarteto" className="focus:bg-white/10 focus:text-white">
                    Quarteto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/25 bg-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="text-white">Registrar estatísticas</Label>
              <p className="text-xs text-blue-50/80">
                Exige que a mesa categorize os pontos de cada equipe durante as partidas.
              </p>
            </div>
            <Switch
              checked={form.hasStatistics}
              onCheckedChange={(checked) => setForm({ ...form, hasStatistics: checked })}
              className="data-[state=checked]:bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">Formato de disputa</Label>
            <Select
              value={form.formatId}
              onValueChange={(value) => setForm({ ...form, formatId: value as TournamentFormatId })}
            >
              <SelectTrigger className="bg-white/15 border-white/30 text-white focus:ring-white/70 focus:ring-offset-0">
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent className="max-h-72 bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                {availableFormats.map((format) => (
                  <SelectItem key={format.id} value={format.id} className="focus:bg-white/10 focus:text-white">
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">{format.name}</span>
                      <span className="text-xs text-blue-50/80">{format.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/25 bg-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="text-white">Incluir disputa de 3º lugar</Label>
              <p className="text-xs text-blue-50/80">Disponível para formatos eliminatórios compatíveis.</p>
            </div>
            <Switch
              checked={form.includeThirdPlace}
              onCheckedChange={(checked) => setForm({ ...form, includeThirdPlace: checked })}
              className="data-[state=checked]:bg-white"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'games',
      title: 'Configurações das partidas',
      description: 'Personalize o formato de sets em cada fase e ajuste os critérios de desempate.',
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white text-base">Formato das Partidas por Fase</Label>
              <Badge variant="outline" className="border-white/30 text-white">
                {availableTournamentFormats[form.formatId]?.name}
              </Badge>
            </div>
            <p className="text-xs text-blue-50/80">
              Configure o formato de cada fase do torneio de acordo com a estrutura selecionada.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {getFormatPhases(form.formatId).map((phase) => (
              <div key={phase.key} className="space-y-3 rounded-2xl border border-white/25 bg-white/10 p-4">
              <div>
                  <Label className="text-white">{phase.label}</Label>
                  <p className="text-xs text-blue-50/80">Selecione o formato das partidas desta fase.</p>
              </div>
              <Select
                  value={form.matchFormats[phase.key] || 'melhorDe3'}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                      matchFormats: { ...form.matchFormats, [phase.key]: value as MatchFormatOption },
                  })
                }
              >
                <SelectTrigger className="bg-white/15 border-white/30 text-white focus:ring-white/70 focus:ring-offset-0">
                    <SelectValue placeholder={`Formato - ${phase.label}`} />
                </SelectTrigger>
                <SelectContent className="bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                  {matchFormatOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="focus:bg-white/10 focus:text-white"
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-semibold">{option.title}</span>
                        <span className="text-xs text-blue-50/80">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            ))}
          </div>
          <div
            className={cn(
              'space-y-3 rounded-2xl border border-white/25 bg-white/10 p-4',
              !form.includeThirdPlace && 'opacity-70',
            )}
          >
            <div>
              <Label className="text-white">Disputa de 3º lugar</Label>
              <p className="text-xs text-blue-50/80">
                Escolha um formato independente para a partida extra entre os semifinalistas.
              </p>
            </div>
            <Select
              value={form.matchFormats.thirdPlace}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  matchFormats: { ...form.matchFormats, thirdPlace: value as MatchFormatOption },
                })
              }
              disabled={!form.includeThirdPlace}
            >
              <SelectTrigger className="bg-white/15 border-white/30 text-white focus:ring-white/70 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-70">
                <SelectValue placeholder="Formato da disputa de 3º lugar" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                {matchFormatOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="focus:bg-white/10 focus:text-white"
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">{option.title}</span>
                      <span className="text-xs text-blue-50/80">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.includeThirdPlace && (
              <p className="text-xs text-blue-50/70">
                Ative a disputa de 3º lugar na etapa anterior para habilitar essa configuração.
              </p>
            )}
          </div>
          <div className="space-y-3 rounded-2xl border border-white/25 bg-white/10 p-4">
            <div>
              <Label className="text-white">Sistema de pontuação (padrão do sistema)</Label>
              <p className="text-xs text-blue-50/80 mb-3">
                Pontuação automática aplicada a todas as partidas do torneio.
              </p>
            </div>
            <div className="space-y-3 text-xs text-blue-50/90">
              <div className="rounded-lg bg-white/5 p-3 border border-white/20">
                <p className="font-semibold text-white mb-2">Partidas de melhor de 3 sets:</p>
                <ul className="space-y-1 ml-4">
                  <li>• <span className="font-semibold text-emerald-200">3 pontos</span> para vitória por 2 sets a 0</li>
                  <li>• <span className="font-semibold text-blue-200">2 pontos</span> para vitória por 2 sets a 1</li>
                  <li>• <span className="font-semibold text-amber-200">1 ponto</span> para derrota por 1 set a 2</li>
                  <li>• <span className="font-semibold text-rose-200">0 pontos</span> para derrota por 0 set a 2</li>
                </ul>
              </div>
              <div className="rounded-lg bg-white/5 p-3 border border-white/20">
                <p className="font-semibold text-white mb-2">Partidas de set único:</p>
                <ul className="space-y-1 ml-4">
                  <li>• <span className="font-semibold text-emerald-200">3 pontos</span> para vitória</li>
                  <li>• <span className="font-semibold text-rose-200">0 pontos</span> para derrota</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/25 bg-white/10 p-4">
            <div>
              <Label className="text-white">Ordem dos critérios de desempate</Label>
              <p className="text-xs text-blue-50/80">
                Ajuste a prioridade aplicada aos resultados da fase classificatória.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-blue-50/70 mb-2 flex items-center gap-2">
                <GripVertical size={14} className="text-blue-50/50" />
                Arraste os itens para reordenar a prioridade
              </p>
              {form.tieBreakerOrder.map((criterion, index) => (
                <div
                  key={`${criterion}-${index}`}
                  draggable
                  onDragStart={(e) => handleTieBreakerDragStart(e, index)}
                  onDragOver={handleTieBreakerDragOver}
                  onDrop={(e) => handleTieBreakerDrop(e, index)}
                  className="flex items-center gap-3 rounded-xl border border-white/25 bg-white/5 px-3 py-2 cursor-move hover:bg-white/10 hover:border-white/35 transition-all"
                >
                  <GripVertical size={16} className="text-blue-50/50 flex-shrink-0" />
                  <span className="w-10 text-xs font-semibold text-blue-50/80">{index + 1}º</span>
                  <Select
                    value={criterion}
                    onValueChange={(value) => handleTieBreakerChange(index, value as TieBreakerCriterion)}
                  >
                    <SelectTrigger className="bg-transparent border-white/25 text-white focus:ring-white/70 focus:ring-offset-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950/80 text-white border-white/30 backdrop-blur-xl">
                      {tieBreakerOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="focus:bg-white/10 focus:text-white"
                          disabled={form.tieBreakerOrder.includes(option.value) && option.value !== criterion}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]

  const totalSteps = steps.length
  const safeStepIndex = Math.min(Math.max(currentStep, 0), totalSteps - 1)
  const activeStep = steps[safeStepIndex]
  const stepValidations = [
    Boolean(normalizeString(form.name)),
    Boolean(normalizeString(form.category) && normalizeString(form.modality) && form.formatId),
    true,
  ]
  const isCurrentStepValid = stepValidations[safeStepIndex]
  const isLastStep = safeStepIndex === totalSteps - 1

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft size={18} />
                Voltar
              </Button>
            </Link>
            <div className="hidden md:flex items-center gap-2 text-white/70">
              <Trophy className="text-yellow-300" size={20} />
              <span>Gestão completa dos seus torneios oficiais</span>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-lg">
              <Trophy className="text-yellow-300" size={28} />
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Circuito profissional</p>
                <h1 className="text-3xl sm:text-4xl font-semibold">Central de Torneios</h1>
              </div>
            </div>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Crie novas etapas, visualize informações e mantenha a organização da temporada com um visual inspirado na arena principal.
            </p>
          </div>
        </div>

        <div className="mb-12 flex flex-wrap gap-4 justify-center">
          {canManageTournaments ? (
            <Dialog
              open={open}
              onOpenChange={(value) => {
                setOpen(value)
                if (!value) {
                  setCurrentStep(0)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="flex items-center gap-2 bg-white/15 border border-white/20 text-white hover:bg-white/25"
                  disabled={authLoading || rolesLoading}
                >
                  <Plus size={20} />
                  Criar Novo Torneio
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[92vw] max-w-3xl md:w-[85vw] lg:max-w-4xl xl:max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#0b4f91]/70 bg-gradient-to-br from-[#0a6fd8] via-[#4cc9ff] to-[#0580c9] p-6 text-white shadow-[0_40px_80px_rgba(15,23,42,0.45)] sm:p-8">
                <DialogHeader className="space-y-4">
                  <DialogTitle className="text-2xl font-extrabold text-white sm:text-3xl">
                    Criar novo torneio
                  </DialogTitle>
                  <DialogDescription className="text-sm font-semibold text-blue-50/90">
                    Monte o torneio em etapas rápidas para liberar a geração automática de chaves.
                  </DialogDescription>
                  <div className="flex flex-col gap-1 rounded-2xl bg-white/15 p-3 text-xs font-semibold text-blue-50/90 sm:flex-row sm:items-center sm:justify-between">
                    <span>Etapa {safeStepIndex + 1} de {totalSteps}</span>
                    <span className="text-sm font-bold text-white sm:text-base">{activeStep.title}</span>
                  </div>
                </DialogHeader>
                <div className="space-y-6">
                  <p className="text-sm text-blue-50/90">{activeStep.description}</p>
                  {activeStep.content}
                </div>
                <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false)
                      setCurrentStep(0)
                    }}
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Cancelar
                  </Button>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {safeStepIndex > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                      >
                        Voltar
                      </Button>
                    )}
                    {isLastStep ? (
                      <Button
                        onClick={createTournament}
                        className="bg-white text-slate-900 hover:bg-white/90"
                      >
                        Criar torneio
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1))}
                        disabled={!isCurrentStepValid}
                        className="bg-white text-slate-900 hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60"
                      >
                        Próximo
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              className="flex items-center gap-2 bg-white/15 border border-white/20 text-white hover:bg-white/25"
              onClick={() =>
                toast({
                  title: "Acesso restrito",
                  description: "Solicite permissão ao administrador para criar torneios.",
                })
              }
              disabled={authLoading || rolesLoading || !user}
            >
              <Plus size={20} />
              Criar Novo Torneio
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80">
            <span className="text-white/70">Filtrar por status:</span>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'active' | 'completed' | 'all')}>
              <SelectTrigger className="w-[160px] border-white/30 bg-white/5 text-white focus:ring-white/60 focus:ring-offset-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="border-white/20 bg-slate-900/90 text-white">
                <SelectItem value="active" className="focus:bg-white/10 focus:text-white">
                  Ativos
                </SelectItem>
                <SelectItem value="completed" className="focus:bg-white/10 focus:text-white">
                  Finalizados
                </SelectItem>
                <SelectItem value="all" className="focus:bg-white/10 focus:text-white">
                  Todos
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((tournament) => {
            const statusStyles =
              tournament.status === "active"
                ? "bg-emerald-400/15 text-emerald-50 border-emerald-200/40"
                : tournament.status === "completed"
                ? "bg-white/10 text-white border-white/20"
                : "bg-amber-400/15 text-amber-50 border-amber-200/40"

            return (
              <Card
                key={tournament.id}
                className="bg-white/10 border-white/20 text-white backdrop-blur-xl transition-all hover:bg-white/15 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-2xl font-semibold leading-tight">{tournament.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-white/70">
                        <MapPin size={16} className="text-white/60" />
                        {tournament.location || "Local a definir"}
                      </CardDescription>
                      <CardDescription className="flex items-center gap-2 text-white/70">
                        <Calendar size={16} className="text-white/60" />
                        {formatDateShortPtBr(tournament.start_date)}
                        <span className="text-white/40">até</span>
                        {formatDateShortPtBr(tournament.end_date)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("uppercase tracking-wide", statusStyles)}>
                      {tournament.status === "active"
                        ? "Ativo"
                        : tournament.status === "completed"
                        ? "Finalizado"
                        : "Em breve"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Trophy size={16} className="text-yellow-300" />
                      <span>Torneio oficial</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/tournament/${tournament.id}`} className="flex-1 min-w-[140px]">
                        <Button className="w-full bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">Ver Torneio</Button>
                      </Link>
                      {tournament.status !== 'completed' && (
                        <>
                          {tournament.status !== 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 border-emerald-300/40 bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30"
                              onClick={async () => {
                                if (!confirm('Iniciar este torneio?')) return
                                const { error } = await supabase
                                  .from('tournaments')
                                  .update({ status: 'active' })
                                  .eq('id', tournament.id)
                                if (error) {
                                  toast({ title: 'Erro ao iniciar', description: error.message })
                                  return
                                }
                                setTournaments((prev) =>
                                  prev.map((item) =>
                                    item.id === tournament.id ? { ...item, status: 'active' } : item
                                  )
                                )
                                toast({ title: 'Torneio iniciado' })
                              }}
                            >
                              Iniciar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 border-white/40 bg-white/10 text-white hover:bg-white/20"
                            onClick={async () => {
                              if (!confirm('Finalizar este torneio?')) return
                              const { error } = await supabase
                                .from('tournaments')
                                .update({ status: 'completed' })
                                .eq('id', tournament.id)
                              if (error) {
                                toast({ title: 'Erro ao finalizar', description: error.message })
                                return
                              }
                              setTournaments((prev) =>
                                prev.map((item) =>
                                  item.id === tournament.id ? { ...item, status: 'completed' } : item
                                )
                              )
                              toast({ title: 'Torneio finalizado' })
                            }}
                          >
                            Finalizar
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                        onClick={async () => {
                          if (!confirm("Tem certeza que deseja apagar este torneio? Esta ação removerá jogos e inscrições."))
                            return
                          const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id)
                          if (error) {
                            toast({ title: "Erro ao deletar", description: error.message })
                            return
                          }
                          setTournaments((prev) => prev.filter((x) => x.id !== tournament.id))
                          toast({ title: "Torneio removido" })
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filteredTournaments.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10">
              <Trophy className="text-yellow-300" size={40} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Nenhum torneio encontrado</h3>
            <p className="text-white/70 max-w-xl mx-auto">
              Ajuste o filtro de status ou crie um novo torneio para iniciar o planejamento da temporada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
