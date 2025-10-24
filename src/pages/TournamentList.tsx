import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, Trophy, Plus, Settings, FileText, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { cn, formatDateToISO, normalizeString } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

type TournamentRow = Tables<'tournaments'>

type TournamentGame = {
  id: string;
  title: string;
  status?: string | null;
  teamA?: { name?: string | null } | null;
  teamB?: { name?: string | null } | null;
};

type TournamentWithGames = TournamentRow & {
  games?: TournamentGame[] | null;
};

export default function TournamentList() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    category: '',
    modality: '',
    hasStatistics: true,
  });
  const [tournaments, setTournaments] = useState<TournamentWithGames[]>([]);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const {
    roles,
    loading: rolesLoading,
  } = useUserRoles(user, authLoading);

  const canManageTournaments = useMemo(
    () => roles.includes('admin_sistema') || roles.includes('organizador'),
    [roles]
  );

  const activeTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status === "active"),
    [tournaments]
  );

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        toast({ title: 'Erro ao carregar torneios', description: error.message })
      } else {
        setTournaments((data as TournamentWithGames[]) || [])
      }
    };
    load();
  }, [toast]);

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
                <h1 className="text-3xl sm:text-4xl font-semibold">Torneios de Vôlei de Praia</h1>
              </div>
            </div>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Acompanhe jogos, programe novas etapas e mantenha sua comunidade informada com um visual inspirado na arena principal.
            </p>
          </div>
        </div>

        {/* Tournament Management Actions */}
        <div className="mb-12 flex flex-wrap gap-4 justify-center">
          {canManageTournaments ? (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button
                  className="flex items-center gap-2 bg-white/15 border border-white/20 text-white hover:bg-white/25"
                  disabled={authLoading || rolesLoading}
                >
                  <Plus size={20} />
                  Criar Novo Torneio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-slate-900/80 text-white border-white/20 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">Criar Novo Torneio</DialogTitle>
                <DialogDescription className="text-white/70">
                  Preencha as informações básicas do torneio
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Nome do Torneio</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Campeonato Brasileiro 2024"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="text-white">Local</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Copacabana, Rio de Janeiro"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-white">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-white">Data de Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Categoria</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-white/60 focus:ring-offset-0">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/90 text-white border-white/20">
                        <SelectItem value="M" className="focus:bg-white/10 focus:text-white">Masculino</SelectItem>
                        <SelectItem value="F" className="focus:bg-white/10 focus:text-white">Feminino</SelectItem>
                        <SelectItem value="Misto" className="focus:bg-white/10 focus:text-white">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Modalidade</Label>
                    <Select value={formData.modality} onValueChange={(value) => setFormData({ ...formData, modality: value })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white focus:ring-white/60 focus:ring-offset-0">
                        <SelectValue placeholder="Modalidade" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900/90 text-white border-white/20">
                        <SelectItem value="dupla" className="focus:bg-white/10 focus:text-white">Dupla</SelectItem>
                        <SelectItem value="quarteto" className="focus:bg-white/10 focus:text-white">Quarteto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/5 px-4 py-3">
                  <div className="space-y-1">
                    <Label className="text-white">Registrar estatísticas</Label>
                    <p className="text-xs text-white/60">
                      Escolha se os árbitros deverão classificar cada ponto por categoria.
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasStatistics}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasStatistics: checked })}
                    className="data-[state=checked]:bg-yellow-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowCreateDialog(false)}
                    className="bg-white/5 border border-white/20 text-white hover:bg-white/15"
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-yellow-400/90 text-slate-900 hover:bg-yellow-300"
                    onClick={async () => {
                      if (!user) {
                        toast({ title: 'Faça login para criar um torneio' })
                        return
                      }

                      if (!canManageTournaments) {
                        toast({ title: 'Sem permissão', description: 'Você não tem acesso para criar torneios.' })
                        return
                      }

                      const trimmedName = normalizeString(formData.name)
                      if (!trimmedName) {
                        toast({ title: 'Informe o nome do torneio' })
                        return
                      }

                      const location = normalizeString(formData.location)
                      const category = normalizeString(formData.category)
                      const modality = normalizeString(formData.modality)
                      const startDateISO = formatDateToISO(formData.startDate)
                      const endDateISO = formatDateToISO(formData.endDate)

                      const payload: Tables<'tournaments'>['Insert'] = {
                        name: trimmedName,
                        status: 'upcoming',
                        has_statistics: !!formData.hasStatistics,
                        location: location ?? null,
                        category: category ?? null,
                        modality: modality ?? null,
                        start_date: startDateISO ?? null,
                        end_date: endDateISO ?? null,
                      }

                      const { error } = await supabase.from('tournaments').insert(payload)
                      if (error) {
                        console.error('Erro ao criar torneio', {
                          message: error.message,
                          details: error.details,
                          hint: error.hint,
                          code: error.code,
                        })
                        toast({ title: 'Erro ao criar torneio', description: error.message })
                      } else {
                        toast({ title: 'Torneio criado' })
                        setShowCreateDialog(false)
                        setFormData({
                          name: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          category: '',
                          modality: '',
                          hasStatistics: true,
                        })
                        const { data } = await supabase.from('tournaments').select('*').order('created_at', { descending: true })
                        setTournaments((data as TournamentWithGames[]) || [])
                      }
                    }}
                  >
                    Criar Torneio
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          ) : (
            <Button
              className="flex items-center gap-2 bg-white/15 border border-white/20 text-white hover:bg-white/25"
              onClick={() =>
                toast({
                  title: 'Acesso restrito',
                  description: 'Solicite ao administrador permissão para gerenciar torneios.',
                })
              }
              disabled={authLoading || rolesLoading || !user}
            >
              <Plus size={20} />
              Criar Novo Torneio
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex items-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/20"
          >
            <Settings size={20} />
            Gerenciar Formatos
          </Button>
          <Button
            variant="ghost"
            className="flex items-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/20"
          >
            <FileText size={20} />
            Relatórios
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => {
            const games = Array.isArray(tournament.games)
              ? tournament.games.slice(0, 3)
              : [];
            const statusStyles =
              tournament.status === 'active'
                ? 'bg-emerald-400/15 text-emerald-50 border-emerald-200/40'
                : tournament.status === 'completed'
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-amber-400/15 text-amber-50 border-amber-200/40';

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
                        {tournament.location || 'Local a definir'}
                      </CardDescription>
                      <CardDescription className="flex items-center gap-2 text-white/70">
                        <Calendar size={16} className="text-white/60" />
                        {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString('pt-BR') : '-'}
                        <span className="text-white/40">até</span>
                        {tournament.end_date ? new Date(tournament.end_date).toLocaleDateString('pt-BR') : '-'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("uppercase tracking-wide", statusStyles)}>
                      {tournament.status === 'active'
                        ? 'Ativo'
                        : tournament.status === 'completed'
                        ? 'Finalizado'
                        : 'Em breve'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Users size={16} className="text-white/60" />
                      <span>Torneio oficial</span>
                    </div>

                    <div className="space-y-2">
                      {games.length === 0 ? (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                          Nenhuma partida vinculada ainda.
                        </div>
                      ) : (
                        games.map((game) => (
                          <div
                            key={game.id}
                            className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div>
                              <p className="font-medium text-sm text-white">{game.title}</p>
                              <p className="text-xs text-white/70">
                                {game.teamA?.name} vs {game.teamB?.name}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-white/20 text-xs",
                                game.status === 'em_andamento'
                                  ? 'bg-rose-500/20 text-rose-100'
                                  : 'bg-white/10 text-white'
                              )}
                            >
                              {game.status === 'em_andamento' ? 'Ao vivo' : 'Agendado'}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/tournament/${tournament.id}`} className="flex-1 min-w-[140px]">
                        <Button className="w-full bg-yellow-400/90 text-slate-900 hover:bg-yellow-300">
                          Ver Torneio
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                      >
                        <Settings size={16} />
                        Gerenciar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {activeTournaments.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10">
              <Trophy className="text-yellow-300" size={40} />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">Nenhum torneio ativo</h3>
            <p className="text-white/70 max-w-xl mx-auto">
              Organize uma nova etapa ou ative um torneio existente para começar a registrar partidas e resultados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
