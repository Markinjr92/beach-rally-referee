import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Filter, MapPin, ShieldCheck, Trophy, Users } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useUserRoles } from '@/hooks/useUserRoles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseLocalDateTime } from '@/utils/date'
import { isMatchCompleted } from '@/utils/matchStatus'

type Tournament = Tables<'tournaments'>
type UserProfile = Tables<'users'>
type MatchRow = Tables<'matches'>

type RefereedMatch = MatchRow & {
  tournament_name: string
  referee_name: string
  reference_date: string | null
}

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return 'Datas a definir'
  const startDate = start ? parseLocalDateTime(start) : null
  const endDate = end ? parseLocalDateTime(end) : null

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  })

  if (startDate && endDate) {
    return `${formatter.format(startDate)} — ${formatter.format(endDate)}`
  }

  if (startDate) return formatter.format(startDate)
  if (endDate) return formatter.format(endDate)
  return 'Datas a definir'
}

const formatShortDate = (value: string | null) => {
  if (!value) return 'Sem data'
  const date = parseLocalDateTime(value)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const formatMatchFormat = (match: MatchRow) => {
  const points = Array.isArray(match.points_per_set) && match.points_per_set.length > 0 ? match.points_per_set : [21]

  if (points.length <= 1 || (match.best_of ?? points.length) <= 1) {
    return `1 set de ${points[0]} pontos`
  }

  const allEqual = points.every((point) => point === points[0])
  const mdLabel = `MD${match.best_of ?? points.length}`

  if (allEqual) {
    return `${mdLabel} de ${points[0]}`
  }

  return `${mdLabel} (${points.join(' / ')})`
}

type StatusLabel = {
  value: string
  label: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}

const STATUS_MAP: Record<string, StatusLabel> = {
  active: { value: 'active', label: 'Em andamento', badgeVariant: 'default' },
  upcoming: { value: 'upcoming', label: 'Agendado', badgeVariant: 'secondary' },
  scheduled: { value: 'upcoming', label: 'Agendado', badgeVariant: 'secondary' },
}

const RefereeTournaments = () => {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const { roles } = useUserRoles(user, authLoading)

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [refereedMatches, setRefereedMatches] = useState<RefereedMatch[]>([])
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoadingTournaments(true)
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true })

      if (error) {
        toast({ title: 'Erro ao carregar torneios', description: error.message })
        setLoadingTournaments(false)
        return
      }

      const activeTournaments = (data || []).filter(
        (tournament) => tournament.status !== 'completed' && tournament.status !== 'canceled'
      )

      setTournaments(activeTournaments)
      setLoadingTournaments(false)
    }

    void load()
  }, [toast])

  useEffect(() => {
    const loadRefereedMatches = async () => {
      if (authLoading || !user?.email) return

      setLoadingHistory(true)

      const { data: currentUserProfile, error: currentUserError } = await supabase
        .from('users')
        .select('id,name,email')
        .eq('email', user.email)
        .maybeSingle<UserProfile>()

      if (currentUserError || !currentUserProfile) {
        toast({ title: 'Erro ao identificar usuário', description: currentUserError?.message ?? 'Perfil não encontrado.' })
        setLoadingHistory(false)
        return
      }

      const { data: completedMatches, error: matchesError } = await supabase
        .from('matches')
        .select('id,status,scheduled_at,created_at,best_of,points_per_set,direct_win_format,referee_id,tournament_id,modality,phase,court,team_a_id,team_b_id,side_switch_sum')
        .order('scheduled_at', { ascending: false, nullsFirst: false })

      if (matchesError) {
        toast({ title: 'Erro ao carregar jogos finalizados', description: matchesError.message })
        setLoadingHistory(false)
        return
      }

      const finalizedMatches = (completedMatches || []).filter((match) => isMatchCompleted(match.status))

      const tournamentIds = Array.from(new Set(finalizedMatches.map((match) => match.tournament_id)))
      const refereeIds = Array.from(
        new Set(finalizedMatches.map((match) => match.referee_id).filter((refereeId): refereeId is string => Boolean(refereeId))),
      )

      const [{ data: tournamentData, error: tournamentError }, { data: refereeData, error: refereeError }] = await Promise.all([
        supabase.from('tournaments').select('id,name,created_by').in('id', tournamentIds),
        refereeIds.length > 0 ? supabase.from('users').select('id,name').in('id', refereeIds) : Promise.resolve({ data: [], error: null }),
      ])

      if (tournamentError || refereeError) {
        toast({
          title: 'Erro ao carregar dados de jogos',
          description: tournamentError?.message ?? refereeError?.message ?? 'Erro inesperado',
        })
        setLoadingHistory(false)
        return
      }

      const tournamentMap = new Map((tournamentData || []).map((tournament) => [tournament.id, tournament]))
      const refereeMap = new Map((refereeData || []).map((referee) => [referee.id, referee.name]))

      const isAdmin = roles.includes('admin_sistema')
      const isOrganizer = roles.includes('organizador')

      const roleFilteredMatches = finalizedMatches.filter((match) => {
        const tournament = tournamentMap.get(match.tournament_id)

        if (isAdmin) return true
        if (isOrganizer && tournament?.created_by === currentUserProfile.id) return true
        return match.referee_id === currentUserProfile.id
      })

      const hydratedMatches: RefereedMatch[] = roleFilteredMatches.map((match) => ({
        ...match,
        tournament_name: tournamentMap.get(match.tournament_id)?.name ?? 'Torneio não encontrado',
        referee_name: match.referee_id ? refereeMap.get(match.referee_id) ?? 'Árbitro não identificado' : 'Sem árbitro definido',
        reference_date: match.scheduled_at ?? match.created_at,
      }))

      setRefereedMatches(hydratedMatches)
      setLoadingHistory(false)
    }

    void loadRefereedMatches()
  }, [authLoading, roles, toast, user?.email])

  const headerSubtitle = useMemo(() => {
    if (loadingTournaments) return 'Carregando torneios disponíveis...'
    if (tournaments.length === 0) return 'Nenhum torneio ativo encontrado no momento.'
    return `${tournaments.length} torneio${tournaments.length > 1 ? 's' : ''} disponível(is) para arbitragem.`
  }, [loadingTournaments, tournaments.length])

  const filteredMatches = useMemo(() => {
    const start = startDateFilter ? new Date(`${startDateFilter}T00:00:00`) : null
    const end = endDateFilter ? new Date(`${endDateFilter}T23:59:59`) : null

    return refereedMatches.filter((match) => {
      if (!match.reference_date) return false
      const matchDate = parseLocalDateTime(match.reference_date)
      if (start && matchDate < start) return false
      if (end && matchDate > end) return false
      return true
    })
  }, [endDateFilter, refereedMatches, startDateFilter])

  const matchesByDate = useMemo(() => {
    return filteredMatches.reduce<Record<string, number>>((acc, match) => {
      const key = formatShortDate(match.reference_date)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [filteredMatches])

  const summaryLabel = roles.includes('admin_sistema')
    ? 'Resumo geral de jogos finalizados'
    : roles.includes('organizador')
      ? 'Resumo de jogos finalizados dos seus torneios'
      : 'Resumo de jogos finalizados apitados por você'

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-12 space-y-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Link to="/">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft size={18} />
                Início
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-white/70">
              <Trophy className="text-yellow-300" size={22} />
              <span>Área de arbitragem e histórico</span>
            </div>
          </div>

          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-lg">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/30">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Mesa de Arbitragem</p>
                <h1 className="text-3xl sm:text-4xl font-semibold">/referee</h1>
              </div>
            </div>
            <p className="text-lg text-white/80">{headerSubtitle}</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white/15 border border-white/20 h-auto p-1">
            <TabsTrigger
              value="active"
              className="text-white/80 data-[state=active]:text-white data-[state=active]:bg-white/20"
            >
              Torneios ativos
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-white/80 data-[state=active]:text-white data-[state=active]:bg-white/20"
            >
              Jogos arbitrados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {loadingTournaments && (
                <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle>Carregando...</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70 text-sm">
                      Buscando torneios que ainda estão ativos. Um momento...
                    </p>
                  </CardContent>
                </Card>
              )}

              {!loadingTournaments && tournaments.length === 0 && (
                <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg md:col-span-2 xl:col-span-3">
                  <CardContent className="py-10 text-center text-white/80">
                    Nenhum torneio ativo ou agendado foi encontrado. Volte mais tarde.
                  </CardContent>
                </Card>
              )}

              {tournaments.map((tournament) => {
                const statusInfo = tournament.status ? STATUS_MAP[tournament.status] : undefined

                return (
                  <Card
                    key={tournament.id}
                    className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl flex flex-col"
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-2xl font-semibold leading-tight">
                          {tournament.name}
                        </CardTitle>
                        {statusInfo && (
                          <Badge variant={statusInfo.badgeVariant} className="uppercase tracking-wide">
                            {statusInfo.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-white/70">
                        {tournament.location && (
                          <span className="inline-flex items-center gap-2">
                            <MapPin size={16} />
                            {tournament.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-2">
                          <Calendar size={16} />
                          {formatDateRange(tournament.start_date, tournament.end_date)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <Link to={`/referee/tournament/${tournament.id}`}>
                        <Button className="w-full border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70">
                          Acessar jogos
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="bg-slate-900/60 border border-white/20 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck size={20} />
                  {summaryLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                  <p className="text-white/70 text-sm">Quantidade total (filtro aplicado)</p>
                  <p className="text-3xl font-bold">{filteredMatches.length}</p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/5 p-4 md:col-span-2">
                  <p className="text-white/70 text-sm mb-2">Resumo por data</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(matchesByDate).length === 0 && <span className="text-white/60">Sem jogos no período.</span>}
                    {Object.entries(matchesByDate).map(([date, total]) => (
                      <Badge key={date} variant="secondary" className="bg-white/20 text-white hover:bg-white/20">
                        {date}: {total}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border border-white/20 text-white">
              <CardContent className="pt-6 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Data inicial</label>
                  <Input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} className="bg-white/10 border-white/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Data final</label>
                  <Input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} className="bg-white/10 border-white/30" />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => {
                      setStartDateFilter('')
                      setEndDateFilter('')
                    }}
                  >
                    <Filter size={16} />
                    Limpar filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {loadingHistory && (
                <Card className="bg-white/10 border border-white/20 text-white">
                  <CardContent className="py-8">Carregando histórico de jogos finalizados...</CardContent>
                </Card>
              )}

              {!loadingHistory && filteredMatches.length === 0 && (
                <Card className="bg-white/10 border border-white/20 text-white">
                  <CardContent className="py-8 text-white/70">Nenhum jogo finalizado encontrado para os filtros e permissões atuais.</CardContent>
                </Card>
              )}

              {!loadingHistory && filteredMatches.map((match) => (
                <Card key={match.id} className="bg-white/10 border border-white/20 text-white">
                  <CardContent className="py-4 grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-white/60 uppercase">Torneio</p>
                      <p className="font-semibold">{match.tournament_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase">Formato</p>
                      <p className="font-semibold">{formatMatchFormat(match)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase">Árbitro</p>
                      <p className="font-semibold">{match.referee_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase">Data</p>
                      <p className="font-semibold">{formatShortDate(match.reference_date)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default RefereeTournaments
