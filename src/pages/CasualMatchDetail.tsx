import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Play, Share2, Trash2 } from "lucide-react";
import { getCasualMatch, deleteCasualMatch, casualMatchToGame, type CasualMatch } from "@/lib/casualMatches";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MATCH_FORMAT_PRESETS } from "@/utils/matchConfig";
import { loadMatchState } from "@/lib/matchStateService";
import { shareImage } from "@/lib/shareImage";

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

export default function CasualMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [match, setMatch] = useState<CasualMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    if (!id || !user) return;
    loadMatch();
  }, [id, user]);

  const loadMatch = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const data = await getCasualMatch(id, user.id);
      if (!data) {
        toast({
          title: 'Jogo não encontrado',
          description: 'O jogo solicitado não foi encontrado ou você não tem permissão para visualizá-lo.',
          variant: 'destructive',
        });
        navigate('/casual-matches');
        return;
      }
      setMatch(data);

      // Carregar estado do jogo se existir
      const game = casualMatchToGame(data);
      try {
        const { state } = await loadMatchState(id, game, true);
        setGameState(state);
      } catch (error) {
        // Estado ainda não existe, isso é normal
        console.log('Estado do jogo ainda não criado');
      }
    } catch (error) {
      console.error('Erro ao carregar jogo:', error);
      toast({
        title: 'Erro ao carregar jogo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !user) return;
    setDeleting(true);
    try {
      await deleteCasualMatch(id, user.id);
      toast({
        title: 'Jogo excluído',
        description: 'O jogo foi excluído com sucesso.',
      });
      navigate('/casual-matches');
    } catch (error) {
      console.error('Erro ao excluir jogo:', error);
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    if (!match) return;
    try {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        <div>Carregando...</div>
      </div>
    );
  }

  if (!match) {
    return null;
  }

  const preset = MATCH_FORMAT_PRESETS[match.format_preset as keyof typeof MATCH_FORMAT_PRESETS];
  const game = casualMatchToGame(match);

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/casual-matches">
          <Button variant="ghost" className="mb-6 text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {match.team_a_name} vs {match.team_b_name}
              </h1>
              <div className="flex items-center gap-3">
                <Badge variant={statusBadgeVariants[match.status] || 'outline'}>
                  {statusLabels[match.status] || match.status}
                </Badge>
                <span className="text-white/70">{preset?.label || match.format_preset}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card className="bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Dupla A</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-lg font-semibold">{match.team_a_name}</div>
                <div className="text-white/80">
                  <div>{match.team_a_player_1}</div>
                  <div>{match.team_a_player_2}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Dupla B</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-lg font-semibold">{match.team_b_name}</div>
                <div className="text-white/80">
                  <div>{match.team_b_player_1}</div>
                  <div>{match.team_b_player_2}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/10 border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Informações do Jogo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-white/70">Categoria:</span>
                <span className="ml-2 text-white">{match.category}</span>
              </div>
              <div>
                <span className="text-white/70">Modalidade:</span>
                <span className="ml-2 text-white">{match.modality}</span>
              </div>
              <div>
                <span className="text-white/70">Formato:</span>
                <span className="ml-2 text-white">{preset?.label || match.format_preset}</span>
              </div>
              <div>
                <span className="text-white/70">Pontos por set:</span>
                <span className="ml-2 text-white">{match.points_per_set.join(' / ')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {gameState && (
          <Card className="bg-white/10 border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Placar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gameState.scores.teamA.map((scoreA: number, index: number) => {
                  const scoreB = gameState.scores.teamB[index] || 0;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded">
                      <span className="text-white/70">Set {index + 1}:</span>
                      <div className="flex items-center gap-4">
                        <span className="text-white font-semibold">
                          {match.team_a_name}: {scoreA}
                        </span>
                        <span className="text-white/50">x</span>
                        <span className="text-white font-semibold">
                          {scoreB} :{match.team_b_name}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {gameState.isGameEnded && (
                  <div className="mt-4 p-3 bg-green-500/20 rounded text-center">
                    <span className="text-green-300 font-semibold">
                      Jogo Finalizado - Vencedor: {
                        gameState.setsWon.teamA > gameState.setsWon.teamB
                          ? match.team_a_name
                          : match.team_b_name
                      }
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          {(match.status === 'scheduled' || match.status === 'in_progress') && (
            <Link to={`/casual-matches/${match.id}/referee`} className="flex-1">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <Play className="mr-2 h-4 w-4" />
                {match.status === 'scheduled' ? 'Iniciar Mesa' : 'Continuar Mesa'}
              </Button>
            </Link>
          )}
          <Button
            className="bg-green-600 hover:bg-green-700 text-white border-0"
            onClick={handleShare}
            disabled={match.status !== 'completed'}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Compartilhar
          </Button>
          <ConfirmDialog
            title="Excluir jogo"
            description="Tem certeza que deseja excluir este jogo? Esta ação não pode ser desfeita."
            onConfirm={handleDelete}
          >
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  );
}

