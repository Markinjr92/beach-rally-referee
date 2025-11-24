import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ArrowLeft, Plus, Search, Trash2, Share2, Play, Eye } from "lucide-react";
import { listCasualMatches, deleteCasualMatch, casualMatchToGame, type CasualMatch } from "@/lib/casualMatches";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MATCH_FORMAT_PRESETS } from "@/utils/matchConfig";
import { shareImage } from "@/lib/shareImage";
import { loadMatchState } from "@/lib/matchStateService";
import { supabase } from "@/integrations/supabase/client";

type StatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed';

const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em Andamento',
  completed: 'Finalizado',
  canceled: 'Cancelado',
};

const statusBadgeVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  scheduled: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  canceled: 'destructive',
};

export default function CasualMatches() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles(user, authLoading);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [matches, setMatches] = useState<CasualMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('in_progress');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const isAdmin = roles.includes("admin_sistema");

  useEffect(() => {
    if (!user || authLoading || rolesLoading) return;
    loadMatches();
  }, [user, statusFilter, searchTerm, isAdmin, authLoading, rolesLoading]);

  const loadMatches = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listCasualMatches(
        user.id,
        {
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchTerm || undefined,
        },
        isAdmin
      );
      setMatches(data);

      // Se for admin, buscar nomes dos usuários que criaram os jogos
      if (isAdmin && data.length > 0) {
        const userIds = Array.from(new Set(data.map(m => m.user_id)));
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);

        if (usersData) {
          const namesMap: Record<string, string> = {};
          usersData.forEach(u => {
            namesMap[u.id] = u.name || u.email || 'Usuário desconhecido';
          });
          setUserNames(namesMap);
        }
      } else {
        setUserNames({});
      }
    } catch (error) {
      console.error('Erro ao carregar jogos avulsos:', error);
      toast({
        title: 'Erro ao carregar jogos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await deleteCasualMatch(id, user.id);
      toast({
        title: 'Jogo excluído',
        description: 'O jogo foi excluído com sucesso.',
      });
      await loadMatches();
    } catch (error) {
      console.error('Erro ao excluir jogo:', error);
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = async (match: CasualMatch) => {
    try {
      const game = casualMatchToGame(match);
      let gameState = null;
      try {
        const { state } = await loadMatchState(match.id, game, true);
        gameState = state;
      } catch (error) {
        // Estado ainda não existe, isso é normal
        console.log('Estado do jogo ainda não criado');
      }
      
      await shareImage(match, gameState);
      // Não mostrar toast se foi compartilhamento (já tem feedback nativo)
      // Só mostrar se foi download
      if (!navigator.share || !navigator.canShare) {
        toast({
          title: 'Imagem gerada!',
          description: 'A imagem foi baixada com sucesso.',
        });
      }
    } catch (error) {
      // Ignorar erro se usuário cancelou o compartilhamento
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Erro ao gerar/compartilhar imagem:', error);
      toast({
        title: 'Erro ao gerar imagem',
        description: 'Não foi possível gerar a imagem de compartilhamento.',
        variant: 'destructive',
      });
    }
  };

  const filteredMatches = useMemo(() => {
    return matches;
  }, [matches]);

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4 text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Jogos Avulsos Arbitragem</h1>
              <p className="text-white/80">
                {isAdmin 
                  ? "Visualize e gerencie todos os jogos avulsos do sistema"
                  : "Gerencie seus jogos avulsos sem necessidade de criar um torneio"}
              </p>
            </div>
            <Link to="/casual-matches/create">
              <Button className="border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70">
                <Plus className="mr-2 h-4 w-4" />
                Novo Jogo
              </Button>
            </Link>
          </div>
        </div>

        <Card className="bg-white/10 border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Status</label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="bg-white/10 border-white/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="completed">Finalizado</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Buscar por nome de dupla</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    placeholder="Digite o nome da dupla..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="text-white/80">Carregando jogos...</div>
          </div>
        ) : filteredMatches.length === 0 ? (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="py-12 text-center">
              <p className="text-white/80 text-lg mb-4">
                {searchTerm || statusFilter !== 'in_progress'
                  ? 'Nenhum jogo encontrado com os filtros selecionados.'
                  : 'Você ainda não criou nenhum jogo avulso.'}
              </p>
              <Link to="/casual-matches/create">
                <Button className="border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Jogo
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((match) => {
              const preset = MATCH_FORMAT_PRESETS[match.format_preset as keyof typeof MATCH_FORMAT_PRESETS];
              const game = casualMatchToGame(match);
              
              return (
                <Card key={match.id} className="bg-white/10 border-white/20 hover:bg-white/15 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-white text-lg">
                        {match.team_a_name} vs {match.team_b_name}
                      </CardTitle>
                      <Badge variant={statusBadgeVariants[match.status] || 'outline'}>
                        {statusLabels[match.status] || match.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-white/70">
                      {preset?.label || match.format_preset}
                      {isAdmin && userNames[match.user_id] && (
                        <span className="block text-xs text-white/50 mt-1">
                          Criado por: {userNames[match.user_id]}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="text-sm text-white/80">
                        <span className="font-medium">Dupla A:</span> {match.team_a_player_1} / {match.team_a_player_2}
                      </div>
                      <div className="text-sm text-white/80">
                        <span className="font-medium">Dupla B:</span> {match.team_b_player_1} / {match.team_b_player_2}
                      </div>
                      <div className="text-sm text-white/80">
                        <span className="font-medium">Categoria:</span> {match.category} | <span className="font-medium">Modalidade:</span> {match.modality}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/casual-matches/${match.id}`} className="flex-1 min-w-[100px]">
                        <Button 
                          size="sm" 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                      {match.status === 'scheduled' || match.status === 'in_progress' ? (
                        <Link to={`/casual-matches/${match.id}/referee`} className="flex-1 min-w-[100px]">
                          <Button size="sm" className="w-full border-slate-400/50 bg-slate-600/60 text-white font-semibold hover:bg-slate-600/80 hover:border-slate-400/70">
                            <Play className="mr-2 h-4 w-4" />
                            Mesa
                          </Button>
                        </Link>
                      ) : null}
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white border-0"
                        onClick={() => handleShare(match)}
                        disabled={match.status !== 'completed'}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Excluir jogo"
                        description="Tem certeza que deseja excluir este jogo? Esta ação não pode ser desfeita."
                        onConfirm={() => handleDelete(match.id)}
                        trigger={
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                            disabled={deletingId === match.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

