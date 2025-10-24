import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Trophy, Users } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return 'Datas a definir'
  const startDate = start ? new Date(start) : null
  const endDate = end ? new Date(end) : null

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

type Tournament = Tables<'tournaments'>

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
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true })

      if (error) {
        toast({ title: 'Erro ao carregar torneios', description: error.message })
        setLoading(false)
        return
      }

      const activeTournaments = (data || []).filter(
        (tournament) => tournament.status !== 'completed' && tournament.status !== 'canceled'
      )

      setTournaments(activeTournaments)
      setLoading(false)
    }

    void load()
  }, [toast])

  const headerSubtitle = useMemo(() => {
    if (loading) return 'Carregando torneios disponíveis...'
    if (tournaments.length === 0) return 'Nenhum torneio ativo encontrado no momento.'
    return `${tournaments.length} torneio${tournaments.length > 1 ? 's' : ''} disponível(is) para arbitragem.`
  }, [loading, tournaments.length])

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
              <span>Selecione um torneio ativo para iniciar a arbitragem</span>
            </div>
          </div>

          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-lg">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/30">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Mesa de Arbitragem</p>
                <h1 className="text-3xl sm:text-4xl font-semibold">Torneios ativos</h1>
              </div>
            </div>
            <p className="text-lg text-white/80">{headerSubtitle}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && (
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

          {!loading && tournaments.length === 0 && (
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
                    <Button className="w-full bg-white/15 border border-white/30 text-white hover:bg-white/25">
                      Acessar jogos
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default RefereeTournaments
