import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PublicAvulsoLiveBoard } from '@/components/PublicAvulsoLiveBoard';
import { ArrowLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const FILTERS = [
  { id: 'live', label: 'Ao vivo' },
  { id: 'completed', label: 'Finalizados' },
  { id: 'all', label: 'Todos' },
] as const;

export default function PublicCasualList() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('filtro') || 'live';
  const filtro = raw === 'finalizados' || raw === 'completed' ? 'completed'
    : raw === 'todos' || raw === 'all' ? 'all'
      : 'live';

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
        <p className="text-white/70 text-sm mb-4">
          Placares ao vivo. Encerrados ficam aqui por 2 minutos com o resultado final.
        </p>
        <div className="flex gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setParams(f.id === 'live' ? { filtro: 'ao-vivo' } : { filtro: f.id === 'completed' ? 'finalizados' : 'todos' })}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold',
                filtro === f.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/15',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <PublicAvulsoLiveBoard filter={filtro} pollMs={filtro === 'live' ? 2000 : 8000} />
      </div>
    </div>
  );
}
