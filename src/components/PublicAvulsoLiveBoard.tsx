import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listBeachPublicMatches,
  deleteBeachPublicMatch,
  beachWhatsappText,
  formatMatchClock,
  liveElapsedSec,
  isLivePublicMatch,
  currentSetLine,
  type BeachPublicMatch,
} from '@/lib/beachPublicApi';
import { cn } from '@/lib/utils';

type Filter = 'live' | 'completed' | 'all';

function setsMini(m: BeachPublicMatch) {
  if (!m.sets?.length) return null;
  return m.sets.map((s) => `${s.a}-${s.b}`).join(' · ');
}

function MatchCard({ m, compact, onDeleted }: { m: BeachPublicMatch; compact?: boolean; onDeleted?: (id: string) => void }) {
  const [tick, setTick] = useState(0);
  const [askPass, setAskPass] = useState(false);
  const [password, setPassword] = useState('');
  const [delErr, setDelErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!m.clock_running && m.status !== 'in_progress') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [m.clock_running, m.status, m.id]);
  void tick;
  const live = isLivePublicMatch(m);
  const clock = formatMatchClock(liveElapsedSec(m));
  const wa = m.status === 'completed'
    ? `https://wa.me/?text=${encodeURIComponent(beachWhatsappText(m))}`
    : null;

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDelErr('');
    try {
      await deleteBeachPublicMatch(m.id, password);
      onDeleted?.(m.id);
    } catch (err) {
      setDelErr(err instanceof Error ? err.message : 'Não excluiu');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(
      'relative rounded-xl border p-4',
      live && m.status === 'in_progress'
        ? 'border-emerald-400/50 bg-emerald-500/10'
        : live
          ? 'border-amber-300/40 bg-amber-400/10'
          : 'border-white/20 bg-white/10',
    )}
    >
      <button
        type="button"
        title="Excluir"
        className="absolute top-1.5 right-1.5 z-10 text-white/30 hover:text-white/80 text-[10px] leading-none w-4 h-4"
        onClick={() => {
          setAskPass((v) => !v);
          setDelErr('');
        }}
      >
        ×
      </button>
      <Link to={`/avulso/${m.id}`} className="block">
        <div className="flex items-center justify-between gap-2 mb-2 pr-4">
          <span className={cn(
            'text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
            m.status === 'in_progress' ? 'bg-emerald-400 text-slate-900' : 'bg-white/20 text-white',
          )}
          >
            {m.status === 'in_progress' ? 'Ao vivo' : live ? 'Encerrado agora' : 'Finalizado'}
          </span>
          <span className="tabular-nums text-sm font-semibold text-white/90">{clock}</span>
        </div>
        <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2', compact ? 'text-base' : 'text-lg')}>
          <div className="text-right">
            <div className="font-bold leading-tight truncate">{m.team_a_name}</div>
            <div className="text-[11px] text-pink-300 truncate">{(m.team_a_players || []).join(' · ')}</div>
          </div>
          <div className="text-center min-w-[4.5rem]">
            <div className="text-2xl font-black tabular-nums">
              <span className="text-pink-300">{m.sets_won_a}</span>
              <span className="text-white/50 mx-1">×</span>
              <span className="text-amber-300">{m.sets_won_b}</span>
            </div>
            {m.status === 'in_progress' && (
              <div className="text-xs text-white/70 tabular-nums">{currentSetLine(m)}</div>
            )}
          </div>
          <div className="text-left">
            <div className="font-bold leading-tight truncate">{m.team_b_name}</div>
            <div className="text-[11px] text-amber-300 truncate">{(m.team_b_players || []).join(' · ')}</div>
          </div>
        </div>
        {setsMini(m) && (
          <p className="text-center text-xs text-white/55 mt-2">Sets {setsMini(m)}</p>
        )}
        <p className="text-center text-xs text-white/50 mt-1">Árbitro: {m.referee_name}</p>
      </Link>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="block text-center text-emerald-300 text-sm underline mt-2">
          WhatsApp
        </a>
      )}
      {askPass && (
        <form onSubmit={remove} className="mt-2 flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-24 h-6 rounded bg-black/30 border border-white/20 px-1.5 text-[11px] text-white placeholder:text-white/40"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="h-6 px-1.5 text-[11px] rounded bg-white/15 hover:bg-white/25 disabled:opacity-40"
          >
            {busy ? '…' : 'Ok'}
          </button>
        </form>
      )}
      {delErr && <p className="text-right text-[11px] text-red-300 mt-1">{delErr}</p>}
    </div>
  );
}

export function PublicAvulsoLiveBoard({
  filter = 'live',
  compact = false,
  pollMs = 2500,
  title,
}: {
  filter?: Filter;
  compact?: boolean;
  pollMs?: number;
  title?: string;
}) {
  const [rows, setRows] = useState<BeachPublicMatch[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const status = filter === 'all' ? undefined : filter === 'live' ? 'live' : 'completed';
      listBeachPublicMatches({ limit: 80, status })
        .then((d) => {
          if (!cancelled) {
            setRows(d.matches || []);
            setErr('');
          }
        })
        .catch((e) => {
          if (!cancelled) setErr(e.message || 'Falha ao carregar');
        });
    };
    load();
    const id = window.setInterval(load, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [filter, pollMs]);

  return (
    <div className="space-y-3">
      {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {rows.map((m) => (
        <MatchCard key={m.id} m={m} compact={compact} onDeleted={(id) => setRows((prev) => prev.filter((r) => r.id !== id))} />
      ))}
      {!rows.length && !err && (
        <p className="text-white/60 text-sm">
          {filter === 'live' ? 'Nenhum jogo ao vivo no momento.' : 'Nenhum jogo neste filtro.'}
        </p>
      )}
    </div>
  );
}
