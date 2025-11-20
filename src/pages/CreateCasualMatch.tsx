import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createCasualMatch } from "@/lib/casualMatches";
import { MATCH_FORMAT_PRESETS, type MatchFormatPresetKey } from "@/utils/matchConfig";

export default function CreateCasualMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    modality: 'dupla' as 'dupla' | 'quarteto',
    category: 'Misto' as 'M' | 'F' | 'Misto',
    team_a_name: '',
    team_a_player_1: '',
    team_a_player_2: '',
    team_b_name: '',
    team_b_player_1: '',
    team_b_player_2: '',
    format_preset: 'best3_21_15' as MatchFormatPresetKey,
  });

  const formatOptions = Object.entries(MATCH_FORMAT_PRESETS).map(([key, preset]) => ({
    value: key as MatchFormatPresetKey,
    label: preset.label,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para criar um jogo.',
        variant: 'destructive',
      });
      return;
    }

    // Validações
    if (!formData.team_a_name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome da Dupla A.',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.team_a_player_1.trim() || !formData.team_a_player_2.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe os dois jogadores da Dupla A.',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.team_b_name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome da Dupla B.',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.team_b_player_1.trim() || !formData.team_b_player_2.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe os dois jogadores da Dupla B.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const preset = MATCH_FORMAT_PRESETS[formData.format_preset];
      const match = await createCasualMatch({
        user_id: user.id,
        team_a_name: formData.team_a_name.trim(),
        team_a_player_1: formData.team_a_player_1.trim(),
        team_a_player_2: formData.team_a_player_2.trim(),
        team_b_name: formData.team_b_name.trim(),
        team_b_player_1: formData.team_b_player_1.trim(),
        team_b_player_2: formData.team_b_player_2.trim(),
        category: formData.category,
        modality: formData.modality,
        format_preset: formData.format_preset,
        best_of: preset.bestOf,
        points_per_set: preset.pointsPerSet,
        side_switch_sum: preset.sideSwitchSum,
        status: 'scheduled',
      });

      toast({
        title: 'Jogo criado!',
        description: 'O jogo avulso foi criado com sucesso.',
      });

      navigate(`/casual-matches/${match.id}`);
    } catch (error) {
      console.error('Erro ao criar jogo:', error);
      toast({
        title: 'Erro ao criar jogo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/casual-matches">
          <Button variant="ghost" className="mb-6 text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Criar Novo Jogo Avulso</CardTitle>
            <CardDescription className="text-white/70">
              Preencha os dados abaixo para criar um novo jogo avulso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Configurações Gerais */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Configurações Gerais</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="modality" className="text-white">Modalidade</Label>
                    <Select
                      value={formData.modality}
                      onValueChange={(value) => setFormData({ ...formData, modality: value as 'dupla' | 'quarteto' })}
                    >
                      <SelectTrigger className="bg-white/10 border-white/30 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                        <SelectItem value="dupla">Dupla</SelectItem>
                        <SelectItem value="quarteto">Quarteto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-white">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value as 'M' | 'F' | 'Misto' })}
                    >
                      <SelectTrigger className="bg-white/10 border-white/30 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format_preset" className="text-white">Formato do Jogo</Label>
                  <Select
                    value={formData.format_preset}
                    onValueChange={(value) => setFormData({ ...formData, format_preset: value as MatchFormatPresetKey })}
                  >
                    <SelectTrigger className="bg-white/10 border-white/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950/90 border border-white/20 text-white">
                      {formatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dupla A */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Dupla A</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="team_a_name" className="text-white">Nome da Dupla A *</Label>
                  <Input
                    id="team_a_name"
                    value={formData.team_a_name}
                    onChange={(e) => setFormData({ ...formData, team_a_name: e.target.value })}
                    placeholder="Ex: Dupla Alpha"
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="team_a_player_1" className="text-white">Jogador 1 *</Label>
                    <Input
                      id="team_a_player_1"
                      value={formData.team_a_player_1}
                      onChange={(e) => setFormData({ ...formData, team_a_player_1: e.target.value })}
                      placeholder="Nome do jogador 1"
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team_a_player_2" className="text-white">Jogador 2 *</Label>
                    <Input
                      id="team_a_player_2"
                      value={formData.team_a_player_2}
                      onChange={(e) => setFormData({ ...formData, team_a_player_2: e.target.value })}
                      placeholder="Nome do jogador 2"
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Dupla B */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Dupla B</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="team_b_name" className="text-white">Nome da Dupla B *</Label>
                  <Input
                    id="team_b_name"
                    value={formData.team_b_name}
                    onChange={(e) => setFormData({ ...formData, team_b_name: e.target.value })}
                    placeholder="Ex: Dupla Beta"
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="team_b_player_1" className="text-white">Jogador 1 *</Label>
                    <Input
                      id="team_b_player_1"
                      value={formData.team_b_player_1}
                      onChange={(e) => setFormData({ ...formData, team_b_player_1: e.target.value })}
                      placeholder="Nome do jogador 1"
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team_b_player_2" className="text-white">Jogador 2 *</Label>
                    <Input
                      id="team_b_player_2"
                      value={formData.team_b_player_2}
                      onChange={(e) => setFormData({ ...formData, team_b_player_2: e.target.value })}
                      placeholder="Nome do jogador 2"
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Link to="/casual-matches" className="flex-1">
                  <Button type="button" className="w-full bg-red-600 hover:bg-red-700 text-white border-0">
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  {loading ? 'Criando...' : 'Criar Jogo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

