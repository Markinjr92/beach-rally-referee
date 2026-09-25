import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { listBeachPublicMatches, beachWhatsappText, type BeachPublicMatch } from '@/lib/beachPublicApi';
import { ArrowLeft, Plus } from 'lucide-react';

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PublicCasualList() {
  const [rows, setRows] = useState<BeachPublicMatch[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    listBeachPublicMatches({ limit: 100 })
      .then((d) => setRows(d.matches || []))
      .catch((e) => setErr(e.message || 'Falha ao carregar'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <Link to="/">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" /> Início
            </Button>
          </Link>
          <Link to="/avulso">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Plus className="mr-2 h-4 w-4" /> Novo jogo
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-1">Jogos avulsos públicos</h1>
        <p className="text-white/70 text-sm mb-5">Partidas criadas nesta página, sem login, gravadas no servidor.</p>
        {err && <p className="text-red-300 mb-4">{err}</p>}
        <div className="space-y-3">
          {rows.map((m) => {
            const wa = m.status === 'completed'
              ? `https://wa.me/?text=${encodeURIComponent(beachWhatsappText(m))}`
              : null;
            return (
              <div
                key={m.id}
                className="block rounded-xl border border-white/20 bg-white/10 p-4 hover:bg-white/15"
              >
                <Link to={`/avulso/${m.id}`} className="block">
                <div className="flex justify-between gap-2 text-xs text-white/60 mb-1">
                  <span>{when(m.created_at)}</span>
                  <span>{m.status === 'completed' ? 'Finalizado' : 'Em jogo'}</span>
                </div>
                <div className="font-semibold">
                  {m.team_a_name} {m.sets_won_a} x {m.sets_won_b} {m.team_b_name}
                </div>
                <div className="text-sm text-white/70">Árbitro: {m.referee_name}</div>
                </Link>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 text-sm underline mt-1 inline-block"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            );
          })}
          {!rows.length && !err && <p className="text-white/60">Ainda não há jogos públicos.</p>}
        </div>
      </div>
    </div>
  );
}
