import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CalendarDays, Download, Filter, Search } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { supabase } from '@/integrations/supabase/client'
import { normalizeMatchStatus } from '@/utils/matchStatus'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TournamentOption = {
  id: string
  name: string
}

type MatchRow = {
  id: string
  tournament_id: string | null
  team_a_id: string | null
  team_b_id: string | null
  phase: string | null
  court: string | null
  status: string | null
  scheduled_at: string | null
  created_at: string
}

type TeamOption = {
  id: string
  name: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'canceled', label: 'Cancelado' },
] as const

const statusLabel = (status: string | null) => {
  const normalized = normalizeMatchStatus(status)

  if (normalized === 'scheduled') return 'Agendado'
  if (normalized === 'in_progress') return 'Em andamento'
  if (normalized === 'completed') return 'Finalizado'
  if (normalized === 'canceled') return 'Cancelado'
  return status || 'Sem status'
}

const formatDate = (value: string | null) => {
  if (!value) return 'Não definido'
  return new Date(value).toLocaleString('pt-BR')
}

const getMatchDisplayDate = (match: Pick<MatchRow, 'scheduled_at' | 'created_at'>) => {
  return match.scheduled_at || match.created_at || null
}

const csvSafe = (value: string) => {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const SystemAllGames = () => {
  const { user, loading: authLoading } = useAuth()
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [teamsById, setTeamsById] = useState<Record<string, string>>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<string[]>([])

  const isAdminSistema = useMemo(() => roles.includes('admin_sistema'), [roles])

  useEffect(() => {
    if (!user || !isAdminSistema) return

    const loadData = async () => {
      setLoading(true)

      const [{ data: tournamentData, error: tournamentError }, { data: matchData, error: matchError }] =
        await Promise.all([
          supabase.from('tournaments').select('id, name').order('name', { ascending: true }),
          supabase.from('matches').select('id, tournament_id, team_a_id, team_b_id, phase, court, status, scheduled_at, created_at').order('scheduled_at', { ascending: false }),
        ])

      if (tournamentError) {
        toast({
          title: 'Erro ao carregar torneios',
          description: tournamentError.message,
          variant: 'destructive',
        })
      }

      if (matchError) {
        toast({
          title: 'Erro ao carregar jogos',
          description: matchError.message,
          variant: 'destructive',
        })
        setMatches([])
        setLoading(false)
        return
      }

      setTournaments((tournamentData || []) as TournamentOption[])
      setMatches((matchData || []) as MatchRow[])

      const teamIds = Array.from(
        new Set((matchData || []).flatMap((match) => [match.team_a_id, match.team_b_id]).filter(Boolean) as string[]),
      )

      if (teamIds.length > 0) {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds)

        if (teamsError) {
          toast({
            title: 'Aviso ao carregar equipes',
            description: teamsError.message,
            variant: 'destructive',
          })
        } else {
          const map = (teamsData as TeamOption[]).reduce<Record<string, string>>((acc, team) => {
            acc[team.id] = team.name
            return acc
          }, {})

          setTeamsById(map)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [isAdminSistema, toast, user])

  const tournamentNameMap = useMemo(
    () =>
      tournaments.reduce<Record<string, string>>((acc, tournament) => {
        acc[tournament.id] = tournament.name
        return acc
      }, {}),
    [tournaments],
  )

  const filteredMatches = useMemo(() => {
    const fromDateTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const toDateTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null
    const normalizedSearch = search.trim().toLowerCase()

    return matches.filter((match) => {
      const normalizedStatus = normalizeMatchStatus(match.status)
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false

      if (selectedTournamentIds.length > 0 && (!match.tournament_id || !selectedTournamentIds.includes(match.tournament_id))) {
        return false
      }

      const matchDateReference = getMatchDisplayDate(match)
      const matchTime = matchDateReference ? new Date(matchDateReference).getTime() : null
      if (fromDateTime && (!matchTime || matchTime < fromDateTime)) return false
      if (toDateTime && (!matchTime || matchTime > toDateTime)) return false

      if (!normalizedSearch) return true

      const pool = [
        teamsById[match.team_a_id || ''] || 'Equipe A indefinida',
        teamsById[match.team_b_id || ''] || 'Equipe B indefinida',
        tournamentNameMap[match.tournament_id || ''] || 'Sem torneio',
        match.phase || '',
        match.court || '',
        statusLabel(match.status),
      ]
        .join(' ')
        .toLowerCase()

      return pool.includes(normalizedSearch)
    })
  }, [fromDate, matches, search, selectedTournamentIds, statusFilter, teamsById, toDate, tournamentNameMap])

  const toggleTournament = (tournamentId: string) => {
    setSelectedTournamentIds((prev) =>
      prev.includes(tournamentId) ? prev.filter((id) => id !== tournamentId) : [...prev, tournamentId],
    )
  }

  const exportToExcel = () => {
    if (filteredMatches.length === 0) {
      toast({ title: 'Nenhum jogo para exportar', description: 'Ajuste os filtros e tente novamente.' })
      return
    }

    const header = ['ID do jogo', 'Torneio', 'Equipe A', 'Equipe B', 'Fase', 'Quadra', 'Status', 'Data agendada', 'Criado em']

    const rows = filteredMatches.map((match) => [
      match.id,
      tournamentNameMap[match.tournament_id || ''] || 'Sem torneio',
      teamsById[match.team_a_id || ''] || 'Equipe A indefinida',
      teamsById[match.team_b_id || ''] || 'Equipe B indefinida',
      match.phase || '-',
      match.court || '-',
      statusLabel(match.status),
      formatDate(getMatchDisplayDate(match)),
      formatDate(match.created_at),
    ])

    const csvContent = [header, ...rows].map((row) => row.map((cell) => csvSafe(String(cell))).join(';')).join('\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.setAttribute('download', `todos-jogos-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    toast({ title: 'Exportação concluída', description: 'Arquivo compatível com Excel baixado com sucesso.' })
  }

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando jogos do sistema...</div>
      </div>
    )
  }

  if (!user || !isAdminSistema) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-8 space-y-6 text-white">
        <div className="space-y-2">
          <Link to="/system-data" className="text-sm text-white/80 hover:text-white">
            ← Voltar para Dados do Sistema
          </Link>
          <h1 className="text-3xl font-bold">TODOS JOGOS</h1>
          <p className="text-white/80">
            Consulte e exporte jogos do sistema inteiro com filtros por data, torneios e status.
          </p>
        </div>

        <Card className="bg-white/10 border-white/20 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription className="text-white/80">
              Selecione um ou mais torneios, período e status para refinar a busca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Busca geral</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                  <Input
                    id="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9 bg-white/10 border-white/20"
                    placeholder="Equipe, fase, quadra ou torneio"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof STATUS_OPTIONS)[number]['value'])}>
                  <SelectTrigger className="bg-white/10 border-white/20">
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fromDate">Data inicial</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="pl-9 bg-white/10 border-white/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toDate">Data final</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="pl-9 bg-white/10 border-white/20"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Torneios (múltipla seleção)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 rounded-md border border-white/20 bg-white/5 p-3 max-h-56 overflow-auto">
                {tournaments.map((tournament) => {
                  const checked = selectedTournamentIds.includes(tournament.id)

                  return (
                    <label key={tournament.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleTournament(tournament.id)} />
                      <span>{tournament.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setFromDate('')
                  setToDate('')
                  setSelectedTournamentIds([])
                }}
              >
                Limpar filtros
              </Button>

              <Button type="button" onClick={exportToExcel} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>

              <span className="text-sm text-white/80">{filteredMatches.length} jogo(s) encontrado(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 text-white">
          <CardHeader>
            <CardTitle>Resultados da busca</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-white/80">Carregando jogos...</p>
            ) : filteredMatches.length === 0 ? (
              <p className="text-white/80">Nenhum jogo encontrado com os filtros atuais.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-white/20">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/10">
                    <tr>
                      <th className="text-left p-3">Torneio</th>
                      <th className="text-left p-3">Equipe A</th>
                      <th className="text-left p-3">Equipe B</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Fase</th>
                      <th className="text-left p-3">Quadra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((match) => (
                      <tr key={match.id} className="border-t border-white/10">
                        <td className="p-3">{tournamentNameMap[match.tournament_id || ''] || 'Sem torneio'}</td>
                        <td className="p-3">{teamsById[match.team_a_id || ''] || 'Equipe A indefinida'}</td>
                        <td className="p-3">{teamsById[match.team_b_id || ''] || 'Equipe B indefinida'}</td>
                        <td className="p-3">{statusLabel(match.status)}</td>
                        <td className="p-3">{formatDate(getMatchDisplayDate(match))}</td>
                        <td className="p-3">{match.phase || '-'}</td>
                        <td className="p-3">{match.court || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SystemAllGames
