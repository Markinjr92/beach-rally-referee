import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Check, ChevronsUpDown } from 'lucide-react'

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

type Tournament = Tables<'tournaments'>
type Team = Tables<'teams'>
type Match = Tables<'matches'>

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

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) return
      const { data: t, error: te } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      if (te) { toast({ title: 'Erro ao carregar torneio', description: te.message }); return }
      setTournament(t)

      const { data: reg, error: re } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournamentId)
      if (re) { toast({ title: 'Erro ao carregar equipes', description: re.message }) }
      const registeredTeams = (reg ?? []) as Array<{ teams: Team | null }>
      setTeams(registeredTeams.map((record) => record.teams).filter((team): team is Team => Boolean(team)))

      const { data: m, error: me } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('scheduled_at', { ascending: true })
      if (me) { toast({ title: 'Erro ao carregar jogos', description: me.message }) }
      setMatches(m || [])
    }
    load()
  }, [tournamentId, toast])

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

  const teamOptions = useMemo(() => teams.map(t => ({ value: t.id, label: t.name })), [teams])

  if (!tournament) return (
    <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
      <p className="text-sm text-white/80">Torneio não encontrado</p>
    </div>
  )

  const formattedStartDate = formatDateShortPtBr(tournament.start_date)
  const formattedEndDate = formatDateShortPtBr(tournament.end_date)

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
          <TabsList className="flex flex-col gap-2 rounded-xl bg-white/5 p-1 text-white sm:flex-row sm:items-center sm:justify-start">
            <TabsTrigger value="teams" className="w-full data-[state=active]:bg-white/20 sm:w-auto">
              Duplas cadastradas
            </TabsTrigger>
            <TabsTrigger value="matches" className="w-full data-[state=active]:bg-white/20 sm:w-auto">
              Jogos cadastrados
            </TabsTrigger>
          </TabsList>

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
                        <div>
                          <div className="font-semibold">{team.name}</div>
                          <div className="text-xs text-white/70">{team.player_a} / {team.player_b}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/30 text-white hover:bg-white/15"
                            onClick={async () => {
                              // Delete matches involving this team in this tournament, then unlink and delete team
                              await supabase.from('matches').delete().eq('tournament_id', tournament.id).or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
                              await supabase.from('tournament_teams').delete().eq('tournament_id', tournament.id).eq('team_id', team.id)
                              await supabase.from('teams').delete().eq('id', team.id)
                              const { data: reg } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournament.id)
                              const updatedTeams = (reg ?? []) as Array<{ teams: Team | null }>
                              setTeams(updatedTeams.map((record) => record.teams).filter((team): team is Team => Boolean(team)))
                              toast({ title: 'Dupla removida' })
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
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
                        const { data: reg } = await supabase.from('tournament_teams').select('teams(*)').eq('tournament_id', tournament.id)
                        const refreshedTeams = (reg ?? []) as Array<{ teams: Team | null }>
                        setTeams(refreshedTeams.map((record) => record.teams).filter((team): team is Team => Boolean(team)))
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
                            <Button size="sm" className="bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">
                              Mesa
                            </Button>
                          </Link>
                          <Link to={`/scoreboard/${m.id}`}>
                            <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/15">
                              Placar
                            </Button>
                          </Link>
                          <Link to={`/spectator/${m.id}`}>
                            <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/15">
                              Torcida
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-500/90 text-white hover:bg-red-500"
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
                        const { error } = await supabase.from('matches').insert({
                          tournament_id: tournament.id,
                          team_a_id: matchForm.teamA,
                          team_b_id: matchForm.teamB,
                          scheduled_at: matchForm.scheduled_at || null,
                          court: matchForm.court || null,
                          status: 'scheduled',
                          best_of: selectedMode.bestOf,
                          points_per_set: selectedMode.pointsPerSet,
                        })
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
        </Tabs>
      </div>
    </div>
  )
}
