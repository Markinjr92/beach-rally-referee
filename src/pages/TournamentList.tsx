import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, Trophy, Plus, Settings, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Tables } from "@/integrations/supabase/types";

type TournamentRow = Tables<'tournaments'>

export default function TournamentList() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    category: '',
    modality: ''
  });
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        toast({ title: 'Erro ao carregar torneios', description: error.message })
      } else {
        setTournaments(data || [])
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Trophy className="text-primary" size={40} />
            Torneios de Vôlei de Praia
          </h1>
          <p className="text-xl text-muted-foreground">
            Acompanhe os torneios e jogos em tempo real
          </p>
        </div>

        {/* Tournament Management Actions */}
        <div className="mb-8 flex flex-wrap gap-4 justify-center">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={20} />
                Criar Novo Torneio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Torneio</DialogTitle>
                <DialogDescription>
                  Preencha as informações básicas do torneio
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Torneio</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Campeonato Brasileiro 2024"
                  />
                </div>
                
                <div>
                  <Label htmlFor="location">Local</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Ex: Copacabana, Rio de Janeiro"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Data de Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border">
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modalidade</Label>
                    <Select value={formData.modality} onValueChange={(value) => setFormData({...formData, modality: value})}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Modalidade" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border">
                        <SelectItem value="dupla">Dupla</SelectItem>
                        <SelectItem value="quarteto">Quarteto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={async () => {
                    const payload = {
                      name: formData.name,
                      location: formData.location || null,
                      start_date: formData.startDate || null,
                      end_date: formData.endDate || null,
                      category: formData.category || null,
                      modality: formData.modality || null,
                      status: 'active',
                    } as const

                    const { error } = await supabase.from('tournaments').insert(payload)
                    if (error) {
                      toast({ title: 'Erro ao criar torneio', description: error.message })
                    } else {
                      toast({ title: 'Torneio criado' })
                      setShowCreateDialog(false)
                      setFormData({name: '', location: '', startDate: '', endDate: '', category: '', modality: ''})
                      const { data } = await supabase.from('tournaments').select('*').order('created_at', { descending: true })
                      setTournaments(data || [])
                    }
                  }}>
                    Criar Torneio
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings size={20} />
            Gerenciar Formatos
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <FileText size={20} />
            Relatórios
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">{tournament.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mb-2">
                      <MapPin size={16} />
                      {tournament.location}
                    </CardDescription>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar size={16} />
                      {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString('pt-BR') : '-'} - {' '}
                      {tournament.end_date ? new Date(tournament.end_date).toLocaleDateString('pt-BR') : '-'}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={tournament.status === 'active' ? 'default' : 'secondary'}
                    className="bg-serving text-white"
                  >
                    {tournament.status === 'active' ? 'Ativo' : (tournament.status === 'completed' ? 'Finalizado' : 'Em breve')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users size={16} />
                    <span>Torneio</span>
                  </div>
                  
                  <div className="space-y-2">
                    {tournament.games.slice(0, 3).map((game) => (
                      <div key={game.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{game.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {game.teamA.name} vs {game.teamB.name}
                          </p>
                        </div>
                        <Badge 
                          variant={game.status === 'em_andamento' ? 'destructive' : 'outline'}
                          className={game.status === 'em_andamento' ? 'bg-team-a text-white' : ''}
                        >
                          {game.status === 'em_andamento' ? 'Ao vivo' : 'Agendado'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/tournament/${tournament.id}`} className="flex-1">
                      <Button className="w-full" variant="default">
                        Ver Torneio
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Settings size={16} />
                      Gerenciar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeTournaments.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="mx-auto text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              Nenhum torneio ativo
            </h3>
            <p className="text-muted-foreground">
              Não há torneios com jogos em andamento no momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
