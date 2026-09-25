import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  addBeachPublicPoint,
  beachWhatsappText,
  finishBeachPublicMatch,
  getBeachPublicMatch,
  type BeachPublicMatch,
} from '@/lib/beachPublicApi';

function categoryLabel(c: string) {
  if (c === 'M') return 'Masculino';
  if (c === 'F') return 'Feminino';
  return 'Misto';
}

function setsLine(m: BeachPublicMatch) {
  if (!m.sets.length) return '—';
  return m.sets.map((s) => `${s.a}-${s.b}`).join('  ·  ');
}

export default function PublicCasualPlay() {
  const { id } = useParams();
  const { toast } = useToast();
  const [match, setMatch] = useState<BeachPublicMatch | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { match: row } = await getBeachPublicMatch(id);
    setMatch(row);
  }, [id]);

  useEffect(() => {
    load().catch((err) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    });
  }, [load, toast]);

  const point = async (team: 'A' | 'B', delta: 1 | -1) => {
    if (!id || busy || match?.status === 'completed') return;
    setBusy(true);
    try {
      const { match: row } = await addBeachPublicPoint(id, team, delta);
      setMatch(row);
    } catch (err) {
      toast({ title: 'Placar', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const { match: row } = await finishBeachPublicMatch(id);
      setMatch(row);
    } catch (err) {
      toast({ title: 'Encerrar', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        Carregando jogo…
      </div>
    );
  }

  const done = match.status === 'completed';
  const wa = `https://wa.me/?text=${encodeURIComponent(beachWhatsappText(match))}`;
  const setN = match.current_set + 1;
  const target = match.points_per_set[match.current_set] ?? match.points_per_set.at(-1) ?? 21;

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-5 max-w-lg">
        <div className="flex justify-between text-sm text-white/70 mb-3">
          <Link to="/avulso" className="underline">Novo jogo</Link>
          <Link to="/avulsos" className="underline">Todos os jogos</Link>
        </div>
        <p className="text-center text-white/80 text-sm mb-1">Árbitro: <b className="text-white">{match.referee_name}</b></p>
        <p className="text-center text-white/60 text-xs mb-4">
          {match.modality === 'quarteto' ? 'Quarteto' : 'Dupla'} · {categoryLabel(match.category)}
        </p>

        {!done ? (
          <>
            <p className="text-center mb-2">Set {setN} · até {target} (diferença 2)</p>
            <p className="text-center text-2xl font-bold mb-4">{match.sets_won_a} — {match.sets_won_b}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['A', 'B'] as const).map((side) => {
                const name = side === 'A' ? match.team_a_name : match.team_b_name;
                const score = side === 'A' ? match.score_a : match.score_b;
                const players = side === 'A' ? match.team_a_players : match.team_b_players;
                return (
                  <div key={side} className="rounded-xl border border-white/20 bg-white/10 p-3 text-center">
                    <div className="font-semibold truncate">{name}</div>
                    <div className="text-[11px] text-white/60 truncate">{players.join(' · ')}</div>
                    <div className="text-5xl font-black my-3 tabular-nums">{score}</div>
                    <div className="flex gap-2">
                      <Button className="flex-1 h-14 text-2xl bg-white/15 hover:bg-white/25" disabled={busy} onClick={() => point(side, -1)}>−</Button>
                      <Button className="flex-[2] h-14 text-2xl bg-emerald-500 hover:bg-emerald-600" disabled={busy} onClick={() => point(side, 1)}>+1</Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {match.sets.length > 0 && (
              <p className="text-center text-sm text-white/70 mb-4">Sets: {setsLine(match)}</p>
            )}
            <Button variant="outline" className="w-full border-white/30 text-white" disabled={busy} onClick={finish}>
              Encerrar partida agora
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-white/20 bg-white/10 p-5 text-center space-y-4">
            <h1 className="text-2xl font-bold">Fim de jogo</h1>
            <p className="text-xl">{match.team_a_name} {match.sets_won_a} x {match.sets_won_b} {match.team_b_name}</p>
            <p className="text-white/80">Sets: {setsLine(match)}</p>
            <p>Árbitro: <b>{match.referee_name}</b></p>
            <a href={wa} target="_blank" rel="noreferrer">
              <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white">
                Compartilhar no WhatsApp
              </Button>
            </a>
            <Link to="/avulso" className="block">
              <Button variant="ghost" className="w-full text-white">Criar outro jogo</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
