import { MATCH_FORMAT_PRESETS } from '@/utils/matchConfig';

const DEFAULT_API = 'https://api-bolao.markinjr92.com.br/v1';

export function beachApiBase() {
  const raw = (import.meta.env.VITE_BOLAO_API_URL as string | undefined) || DEFAULT_API;
  return raw.replace(/\/$/, '');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${beachApiBase()}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    throw new Error(String(data.error || data.message || res.statusText));
  }
  return data as T;
}

export type BeachPublicMatch = {
  id: string;
  referee_name: string;
  modality: 'dupla' | 'quarteto';
  category: 'M' | 'F' | 'Misto';
  format_preset: string;
  best_of: number;
  points_per_set: number[];
  direct_win_format: boolean;
  team_a_name: string;
  team_a_players: string[];
  team_b_name: string;
  team_b_players: string[];
  status: 'in_progress' | 'completed';
  sets: { a: number; b: number }[];
  current_set: number;
  score_a: number;
  score_b: number;
  sets_won_a: number;
  sets_won_b: number;
  winner: 'A' | 'B' | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type BeachPublicCreateBody = {
  referee_name: string;
  modality: 'dupla' | 'quarteto';
  category: 'M' | 'F' | 'Misto';
  format_preset: string;
  direct_win_format: boolean;
  team_a_name: string;
  team_a_player_1: string;
  team_a_player_2: string;
  team_a_player_3?: string;
  team_a_player_4?: string;
  team_b_name: string;
  team_b_player_1: string;
  team_b_player_2: string;
  team_b_player_3?: string;
  team_b_player_4?: string;
};

export const createBeachPublicMatch = (body: BeachPublicCreateBody) =>
  request<{ match: BeachPublicMatch }>('/beach/public-matches', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getBeachPublicMatch = (id: string) =>
  request<{ match: BeachPublicMatch }>(`/beach/public-matches/${encodeURIComponent(id)}`);

export const listBeachPublicMatches = (qs: { limit?: number; status?: string } = {}) => {
  const p = new URLSearchParams();
  if (qs.limit) p.set('limit', String(qs.limit));
  if (qs.status) p.set('status', qs.status);
  const q = p.toString();
  return request<{ matches: BeachPublicMatch[] }>(`/beach/public-matches${q ? `?${q}` : ''}`);
};

export const addBeachPublicPoint = (id: string, team: 'A' | 'B', delta: 1 | -1 = 1) =>
  request<{ match: BeachPublicMatch }>(`/beach/public-matches/${encodeURIComponent(id)}/point`, {
    method: 'POST',
    body: JSON.stringify({ team, delta }),
  });

export const finishBeachPublicMatch = (id: string) =>
  request<{ match: BeachPublicMatch }>(`/beach/public-matches/${encodeURIComponent(id)}/finish`, {
    method: 'POST',
    body: '{}',
  });

export function beachWhatsappText(m: BeachPublicMatch) {
  const format = MATCH_FORMAT_PRESETS[m.format_preset as keyof typeof MATCH_FORMAT_PRESETS]?.label || m.format_preset;
  const winnerName = m.winner === 'B' ? m.team_b_name : m.team_a_name;
  const sets = m.sets.length ? m.sets.map((s) => `${s.a}-${s.b}`).join('  ·  ') : '';
  return [
    '🏐 Jogo avulso — VB Jukin',
    `${m.team_a_name} ${m.sets_won_a} x ${m.sets_won_b} ${m.team_b_name}`,
    sets ? `Sets: ${sets}` : '',
    m.status === 'completed' ? `Vencedor: ${winnerName}` : '',
    `Árbitro: ${m.referee_name}`,
    `${m.modality === 'quarteto' ? 'Quarteto' : 'Dupla'} · ${m.category === 'M' ? 'Masculino' : m.category === 'F' ? 'Feminino' : 'Misto'}`,
    format,
  ].filter(Boolean).join('\n');
}
