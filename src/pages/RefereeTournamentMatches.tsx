import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, SlidersHorizontal } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateShortPtBr, formatDateTimePtBr, parseLocalDateTime } from '@/utils/date'

type Tournament = Tables<'tournaments'>
type Team = Pick<Tables<'teams'>, 'id' | 'name'>

type MatchWithTeams = Tables<'matches'> & {
  team_a: Team | null
  team_b: Team | null
}

type StatusFilter = 'all' | 'not_started'
type OrderFilter = 'asc' | 'desc'

const statusLabels: Record<string, string> = {
  scheduled: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Finalizado',
  canceled: 'Cancelado',
}

const RefereeTournamentMatches = () => {
  const { tournamentId } = useParams()
  const { toast } = useToast()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [courtFilter, setCourtFilter] = useState('all')
  const [order, setOrder] = useState<OrderFilter>('asc')

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) return
      setLoading(true)

      const [{ data: tournamentData, error: tournamentError }, { data: matchesData, error: matchesError }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase
          .from('matches')
          .select(`*, team_a:teams!matches_team_a_id_fkey(id, name), team_b:teams!matches_team_b_id_fkey(id, name)`)
          .eq('tournament_id', tournamentId)
          .order('scheduled_at', { ascending: true }),
      ])

      if (tournamentError) {
        toast({ title: 'Erro ao carregar torneio', description: tournamentError.message })
        setLoading(false)
        return
      }

      if (matchesError) {
        toast({ title: 'Erro ao carregar jogos', description: matchesError.message })
      }

      setTournament(tournamentData ?? null)
      const parsedMatches = ((matchesData as MatchWithTeams[]) || []).map((match) => ({
        ...match,
        team_a: match.team_a ?? null,
        team_b: match.team_b ?? null,
      }))
      setMatches(parsedMatches)
      setLoading(false)
    }

    void load()
  }, [toast, tournamentId])

  const availableCourts = useMemo(() => {
    const courts = matches
      .map((match) => match.court?.trim())
      .filter((value): value is string => Boolean(value))
    return Array.from(new Set(courts))
  }, [matches])

  const filteredMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      const statusValue = match.status || 'scheduled'
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'not_started' && statusValue === 'scheduled')
      const matchesCourt = courtFilter === 'all' || (match.court || '').trim() === courtFilter
      return matchesStatus && matchesCourt
    })

    const sorted = [...filtered].sort((a, b) => {
      const getTime = (value: string | null) => {
        const date = parseLocalDateTime(value)
        if (!date) return order === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
        return date.getTime()
      }

      const timeA = getTime(a.scheduled_at)
      const timeB = getTime(b.scheduled_at)

      return order === 'asc' ? timeA - timeB : timeB - timeA
    })

    return sorted
  }, [matches, statusFilter, courtFilter, order])

  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center text-white">
        <p className="text-lg">Torneio não informado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link to="/referee" className="w-fit">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft size={18} />
                Torneios
              </Button>
            </Link>
            {tournament && (
              <div className="text-right md:text-left">
                <h1 className="text-3xl font-semibold">{tournament.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/75">
                  {tournament.location && (
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={16} />
                      {tournament.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <Calendar size={16} />
                    {formatDateShortPtBr(tournament.start_date)} — {formatDateShortPtBr(tournament.end_date)}
                  </span>
                  {tournament.category && (
                    <Badge variant="secondary" className="bg-white/10 text-white">
                      {tournament.category}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal size={18} />
                Filtros de jogos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-white/70">Status</span>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:ring-white/40">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="not_started">Somente não iniciados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-white/70">Quadra</span>
                  <Select value={courtFilter} onValueChange={setCourtFilter}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:ring-white/40">
                      <SelectValue placeholder="Todas as quadras" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                      <SelectItem value="all">Todas as quadras</SelectItem>
                      {availableCourts.map((court) => (
                        <SelectItem key={court} value={court}>
                          Quadra {court}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-white/70">Ordenar por horário</span>
                  <Select value={order} onValueChange={(value) => setOrder(value as OrderFilter)}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white focus:ring-white/40">
                      <SelectValue placeholder="Ordenação" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                      <SelectItem value="asc">Mais próximos primeiro</SelectItem>
                      <SelectItem value="desc">Mais distantes primeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!loading && !tournament && (
            <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg">
              <CardContent className="py-6 text-center text-white/80">
                Não foi possível localizar as informações do torneio.
              </CardContent>
            </Card>
          )}
          {loading ? (
            <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg">
              <CardContent className="py-10 text-center text-white/80">
                Carregando lista de jogos...
              </CardContent>
            </Card>
          ) : filteredMatches.length === 0 ? (
            <Card className="bg-white/10 border border-white/20 text-white backdrop-blur-lg">
              <CardContent className="py-10 text-center text-white/80">
                Nenhum jogo encontrado com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            filteredMatches.map((match) => (
              <Card
                key={match.id}
                className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl"
              >
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2">
                        <Clock size={16} />
                        {formatDateTimePtBr(match.scheduled_at, { fallback: 'Horário a definir' })}
                      </span>
                      {match.court && (
                        <Badge variant="outline" className="border-white/40 text-white">
                          Quadra {match.court}
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-white/40 text-white">
                        {statusLabels[match.status || 'scheduled'] || match.status || 'Agendado'}
                      </Badge>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {match.team_a?.name ?? 'Equipe A'} vs {match.team_b?.name ?? 'Equipe B'}
                      </h2>
                      <p className="text-sm uppercase tracking-wide text-white/60">
                        {match.phase || 'Jogo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/referee/${match.id}`}>
                      <Button size="sm" className="bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">
                        Abrir mesa
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default RefereeTournamentMatches
