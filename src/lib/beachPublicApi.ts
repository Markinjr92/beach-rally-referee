import { MATCH_FORMAT_PRESETS } from '@/utils/matchConfig';
import { createDefaultGameState } from '@/lib/matchState';
import type { Game, GameState } from '@/types/volleyball';

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
  side_switch_sum?: number[];
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
  updated_at?: string;
  elapsed_sec?: number;
  clock_started_at?: string | null;
  clock_running?: boolean;
  game_state?: GameState | null;
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

export function formatMatchClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function liveElapsedSec(m: Pick<BeachPublicMatch, 'elapsed_sec' | 'clock_started_at' | 'clock_running' | 'status'>, now = Date.now()) {
  let sec = Number(m.elapsed_sec) || 0;
  if (m.clock_running && m.clock_started_at) {
    const started = new Date(m.clock_started_at).getTime();
    if (Number.isFinite(started)) sec += Math.max(0, Math.floor((now - started) / 1000));
  }
  return sec;
}

export function isGraceFinished(m: BeachPublicMatch, now = Date.now()) {
  if (m.status !== 'completed' || !m.finished_at) return false;
  const end = new Date(m.finished_at).getTime();
  return Number.isFinite(end) && now - end < 120000;
}

export function isLivePublicMatch(m: BeachPublicMatch, now = Date.now()) {
  return m.status === 'in_progress' || isGraceFinished(m, now);
}

export function currentSetLine(m: BeachPublicMatch) {
  const setNo = (Number(m.current_set) || 0) + 1;
  return `Set ${setNo}: ${m.score_a}–${m.score_b}`;
}

export const deleteBeachPublicMatch = (id: string, password: string) =>
  request<{ ok?: boolean }>(`/beach/public-matches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });

export const saveBeachPublicMatchState = (id: string, state: GameState) =>
  request<{ match: BeachPublicMatch }>(`/beach/public-matches/${encodeURIComponent(id)}/state`, {
    method: 'PUT',
    body: JSON.stringify({ state }),
  });

export function beachPublicMatchToGame(m: BeachPublicMatch): Game {
  const namesA = Array.isArray(m.team_a_players) ? m.team_a_players : [];
  const namesB = Array.isArray(m.team_b_players) ? m.team_b_players : [];
  const toPlayers = (names: string[]) => names.map((name, i) => ({ name, number: i + 1 }));
  const preset = MATCH_FORMAT_PRESETS[m.format_preset as keyof typeof MATCH_FORMAT_PRESETS];
  return {
    id: m.id,
    tournamentId: '',
    title: `${m.team_a_name} vs ${m.team_b_name}`,
    category: m.category,
    modality: m.modality === 'quarteto' ? 'quarteto' : 'dupla',
    format: m.best_of === 1 ? 'melhorDe1' : 'melhorDe3',
    teamA: { name: m.team_a_name, players: toPlayers(namesA) },
    teamB: { name: m.team_b_name, players: toPlayers(namesB) },
    pointsPerSet: Array.isArray(m.points_per_set) ? m.points_per_set : (preset?.pointsPerSet || [21, 21, 15]),
    needTwoPointLead: true,
    directWinFormat: m.direct_win_format ?? false,
    sideSwitchSum: Array.isArray(m.side_switch_sum) && m.side_switch_sum.length
      ? m.side_switch_sum
      : (preset?.sideSwitchSum || [7, 7, 5]),
    hasTechnicalTimeout: false,
    technicalTimeoutSum: 0,
    teamTimeoutsPerSet: 2,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    notes: m.referee_name ? `Árbitro: ${m.referee_name}` : undefined,
    status: m.status === 'completed' ? 'finalizado' : 'em_andamento',
    createdAt: m.created_at,
    updatedAt: m.updated_at || m.created_at,
    hasStatistics: false,
  };
}

export function resolvePublicGameState(match: BeachPublicMatch, game: Game): GameState {
  const defaults = createDefaultGameState(game);
  const raw = match.game_state;
  if (raw && typeof raw === 'object' && (raw as GameState).gameId) {
    return {
      ...defaults,
      ...raw,
      gameId: game.id,
      id: `${game.id}-state`,
    };
  }
  const sets = Array.isArray(match.sets) ? match.sets : [];
  sets.forEach((s, i) => {
    if (defaults.scores.teamA[i] !== undefined) {
      defaults.scores.teamA[i] = Number(s.a) || 0;
      defaults.scores.teamB[i] = Number(s.b) || 0;
    }
  });
  const idx = Math.max(0, Number(match.current_set) || 0);
  if (defaults.scores.teamA[idx] !== undefined) {
    defaults.scores.teamA[idx] = Number(match.score_a) || 0;
    defaults.scores.teamB[idx] = Number(match.score_b) || 0;
  }
  defaults.setsWon = {
    teamA: Number(match.sets_won_a) || 0,
    teamB: Number(match.sets_won_b) || 0,
  };
  defaults.currentSet = idx + 1;
  defaults.isGameEnded = match.status === 'completed';
  return defaults;
}

export function beachWhatsappTextFromGame(game: Game, state: GameState, refereeName?: string) {
  const sets = (state.scores.teamA || []).map((a, i) => {
    const b = state.scores.teamB[i] ?? 0;
    return `${a}-${b}`;
  }).filter((_, i) => i < state.currentSet || state.isGameEnded).join('  ·  ');
  const winnerName = state.setsWon.teamA >= state.setsWon.teamB ? game.teamA.name : game.teamB.name;
  return [
    '🏐 Jogo avulso — VB Jukin',
    `${game.teamA.name} ${state.setsWon.teamA} x ${state.setsWon.teamB} ${game.teamB.name}`,
    sets ? `Sets: ${sets}` : '',
    state.isGameEnded ? `Vencedor: ${winnerName}` : '',
    refereeName ? `Árbitro: ${refereeName}` : (game.notes || ''),
    `${game.modality === 'quarteto' ? 'Quarteto' : 'Dupla'} · ${game.category === 'M' ? 'Masculino' : game.category === 'F' ? 'Feminino' : game.category}`,
  ].filter(Boolean).join('\n');
}

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
