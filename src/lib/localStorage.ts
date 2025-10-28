import type { Game, GameState } from "@/types/volleyball";

export interface StoredMatchState {
  state: GameState;
  savedAt: number;
}

export interface StoredGameConfig {
  game: Game;
  savedAt: number;
}

const MATCH_STATE_PREFIX = "beach-rally-match-state:";
const GAME_CONFIG_PREFIX = "beach-rally-game-config:";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize data for localStorage", error);
    return null;
  }
};

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn("Failed to parse data from localStorage", error);
    return null;
  }
};

export const saveLocalMatchState = (state: GameState) => {
  if (!isBrowser()) return;
  const payload: StoredMatchState = { state, savedAt: Date.now() };
  const serialized = safeStringify(payload);
  if (!serialized) return;
  try {
    window.localStorage.setItem(`${MATCH_STATE_PREFIX}${state.gameId}`, serialized);
  } catch (error) {
    console.warn("Failed to store match state locally", error);
  }
};

export const loadLocalMatchState = (matchId: string): StoredMatchState | null => {
  if (!isBrowser()) return null;
  return safeParse<StoredMatchState>(window.localStorage.getItem(`${MATCH_STATE_PREFIX}${matchId}`));
};

export const clearLocalMatchState = (matchId: string) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(`${MATCH_STATE_PREFIX}${matchId}`);
  } catch (error) {
    console.warn("Failed to clear match state cache", error);
  }
};

export const saveLocalGameConfig = (game: Game) => {
  if (!isBrowser()) return;
  const payload: StoredGameConfig = { game, savedAt: Date.now() };
  const serialized = safeStringify(payload);
  if (!serialized) return;
  try {
    window.localStorage.setItem(`${GAME_CONFIG_PREFIX}${game.id}`, serialized);
  } catch (error) {
    console.warn("Failed to store game config locally", error);
  }
};

export const loadLocalGameConfig = (gameId: string): StoredGameConfig | null => {
  if (!isBrowser()) return null;
  return safeParse<StoredGameConfig>(window.localStorage.getItem(`${GAME_CONFIG_PREFIX}${gameId}`));
};

