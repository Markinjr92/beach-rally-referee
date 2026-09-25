import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { MATCH_FORMAT_PRESETS, type MatchFormatPresetKey } from '@/utils/matchConfig';
import { createBeachPublicMatch } from '@/lib/beachPublicApi';
import { ArrowLeft, List } from 'lucide-react';

const PREFS_KEY = 'vb_jukin_public_avulso_prefs';

type Prefs = {
  modality: 'dupla' | 'quarteto';
  category: 'M' | 'F' | 'Misto';
  format_preset: MatchFormatPresetKey;
  direct_win_format: boolean;
  referee_name: string;
};

const DEFAULT_PREFS: Prefs = {
  modality: 'dupla',
  category: 'Misto',
  format_preset: 'best3_21_15',
  direct_win_format: false,
  referee_name: '',
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      modality: p.modality === 'quarteto' ? 'quarteto' : 'dupla',
      category: p.category === 'M' || p.category === 'F' ? p.category : 'Misto',
      format_preset: p.format_preset && p.format_preset in MATCH_FORMAT_PRESETS
        ? p.format_preset
        : 'best3_21_15',
      direct_win_format: p.direct_win_format === true,
      referee_name: String(p.referee_name || ''),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export default function PublicCasualCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const prefs = useMemo(() => loadPrefs(), []);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ...prefs,
    team_a_name: '',
    team_a_player_1: '',
    team_a_player_2: '',
    team_a_player_3: '',
    team_a_player_4: '',
    team_b_name: '',
    team_b_player_1: '',
    team_b_player_2: '',
    team_b_player_3: '',
    team_b_player_4: '',
  });
  const isQuarteto = form.modality === 'quarteto';
  const teamLabel = isQuarteto ? 'Quarteto' : 'Dupla';

  useEffect(() => {
    savePrefs({
      modality: form.modality,
      category: form.category,
      format_preset: form.format_preset,
      direct_win_format: form.direct_win_format,
      referee_name: form.referee_name,
    });
  }, [form.modality, form.category, form.format_preset, form.direct_win_format, form.referee_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referee_name.trim()) {
      toast({ title: 'Quem arbitrou?', description: 'Informe o nome do árbitro.', variant: 'destructive' });
      return;
    }
    if (!form.team_a_name.trim() || !form.team_b_name.trim()) {
      toast({ title: 'Equipes', description: `Informe o nome das duas ${teamLabel.toLowerCase()}s.`, variant: 'destructive' });
      return;
    }
    if (!form.team_a_player_1.trim() || !form.team_a_player_2.trim() || !form.team_b_player_1.trim() || !form.team_b_player_2.trim()) {
      toast({ title: 'Jogadores', description: 'Informe pelo menos 2 jogadores em cada lado.', variant: 'destructive' });
      return;
    }
    if (isQuarteto && (!form.team_a_player_3.trim() || !form.team_a_player_4.trim() || !form.team_b_player_3.trim() || !form.team_b_player_4.trim())) {
      toast({ title: 'Quarteto', description: 'Informe os 4 jogadores de cada lado.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { match } = await createBeachPublicMatch({
        referee_name: form.referee_name.trim(),
        modality: form.modality,
        category: form.category,
        format_preset: form.format_preset,
        direct_win_format: form.direct_win_format,
        team_a_name: form.team_a_name.trim(),
        team_a_player_1: form.team_a_player_1.trim(),
        team_a_player_2: form.team_a_player_2.trim(),
        team_a_player_3: isQuarteto ? form.team_a_player_3.trim() : undefined,
        team_a_player_4: isQuarteto ? form.team_a_player_4.trim() : undefined,
        team_b_name: form.team_b_name.trim(),
        team_b_player_1: form.team_b_player_1.trim(),
        team_b_player_2: form.team_b_player_2.trim(),
        team_b_player_3: isQuarteto ? form.team_b_player_3.trim() : undefined,
        team_b_player_4: isQuarteto ? form.team_b_player_4.trim() : undefined,
      });
      navigate(`/avulso/${match.id}`);
    } catch (err) {
      toast({
        title: 'Não criou o jogo',
        description: err instanceof Error ? err.message : 'Tente de novo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const playerFields = (side: 'a' | 'b') => {
    const n = isQuarteto ? 4 : 2;
    return (
      <div className="grid gap-3 grid-cols-2">
        {Array.from({ length: n }, (_, i) => {
          const key = `team_${side}_player_${i + 1}` as keyof typeof form;
          return (
            <div key={key} className="space-y-1">
              <Label className="text-white">Jogador {i + 1} *</Label>
              <Input
                value={String(form[key] || '')}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/40"
                required
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <Link to="/">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" /> Início
            </Button>
          </Link>
          <Link to="/avulsos">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <List className="mr-2 h-4 w-4" /> Ver jogos
            </Button>
          </Link>
        </div>
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Jogo avulso</CardTitle>
            <CardDescription className="text-white/70">
              Sem login. Modalidade, formato e árbitro voltam na próxima vez — nomes das duplas não.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white">Quem arbitrou? *</Label>
                <Input
                  value={form.referee_name}
                  onChange={(e) => setForm({ ...form, referee_name: e.target.value })}
                  placeholder="Nome do árbitro"
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/40"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white">Modalidade</Label>
                  <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v as 'dupla' | 'quarteto' })}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-950/95 border-white/20 text-white">
                      <SelectItem value="dupla">Dupla</SelectItem>
                      <SelectItem value="quarteto">Quarteto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as 'M' | 'F' | 'Misto' })}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-950/95 border-white/20 text-white">
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="Misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Formato</Label>
                <Select value={form.format_preset} onValueChange={(v) => setForm({ ...form, format_preset: v as MatchFormatPresetKey })}>
                  <SelectTrigger className="bg-white/10 border-white/30 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-950/95 border-white/20 text-white">
                    {Object.entries(MATCH_FORMAT_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/5 p-3">
                <Switch id="dw" checked={form.direct_win_format} onCheckedChange={(c) => setForm({ ...form, direct_win_format: c })} />
                <Label htmlFor="dw" className="text-white/90 cursor-pointer">Vai a 3 direto</Label>
              </div>

              <div className="space-y-3 rounded-lg border border-white/15 p-3">
                <h3 className="font-semibold">{teamLabel} A</h3>
                <Input
                  value={form.team_a_name}
                  onChange={(e) => setForm({ ...form, team_a_name: e.target.value })}
                  placeholder={`Nome do ${teamLabel} A`}
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/40"
                  required
                />
                {playerFields('a')}
              </div>
              <div className="space-y-3 rounded-lg border border-white/15 p-3">
                <h3 className="font-semibold">{teamLabel} B</h3>
                <Input
                  value={form.team_b_name}
                  onChange={(e) => setForm({ ...form, team_b_name: e.target.value })}
                  placeholder={`Nome do ${teamLabel} B`}
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/40"
                  required
                />
                {playerFields('b')}
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white">
                {loading ? 'Criando…' : 'Começar jogo'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
