import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Trophy, ArrowLeft } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateMediumPtBr } from '@/utils/date'

const formatDate = (value: string | null) => formatDateMediumPtBr(value)

const TournamentInfo = () => {
  const [tournaments, setTournaments] = useState<Tables<'tournaments'>[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .order('start_date', { ascending: true })

      if (error) {
        toast({
          title: 'Não foi possível carregar os torneios',
          description: error.message,
          variant: 'destructive',
        })
      }

      setTournaments(data || [])
      setLoading(false)
    }

    load()
  }, [toast])

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
                Voltar
              </Button>
            </Link>
            <div className="hidden md:flex items-center gap-2 text-white/70">
              <Trophy className="text-yellow-300" size={20} />
              <span>Explore os torneios em andamento</span>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-lg">
              <Trophy className="text-yellow-300" size={28} />
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Calendário oficial</p>
                <h1 className="text-3xl sm:text-4xl font-semibold">Torneios Ativos</h1>
              </div>
            </div>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Confira as etapas em disputa e acompanhe os confrontos e placares de cada torneio.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-white/80">Carregando torneios...</div>
        ) : tournaments.length === 0 ? (
          <div className="flex justify-center py-20 text-white/70">
            Nenhum torneio ativo encontrado no momento.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Card
                key={tournament.id}
                className="bg-white/10 border border-white/20 text-white backdrop-blur-lg transition-all hover:bg-white/15 hover:-translate-y-1"
              >
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold leading-tight flex items-center gap-3">
                    <span>{tournament.name}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-white/70">
                    <MapPin size={16} className="text-white/60" />
                    {tournament.location || 'Local a definir'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-white/60" />
                    {formatDate(tournament.start_date)}
                    <span className="text-white/50">até</span>
                    {formatDate(tournament.end_date)}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  <div className="pt-4">
                    <Button
                      asChild
                      className="w-full bg-yellow-400/90 text-slate-900 hover:bg-yellow-300"
                    >
                      <Link to={`/tournament-info/${tournament.id}`}>Ver confrontos</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TournamentInfo
