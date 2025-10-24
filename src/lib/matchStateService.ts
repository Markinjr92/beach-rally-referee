import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Game, GameState } from "@/types/volleyball";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  MatchScoreRow,
  MatchStateRow,
  createDefaultGameState,
  mapGameStateToRow,
  mapGameStateToScoreRows,
  mapRowToGameState,
  mapScoreRowsToGameState,
} from "./matchState";

type MatchStatesClient = SupabaseClient<Database>;

let matchStatesSupported: boolean | null = null;

const isTableMissingError = (error: PostgrestError | null | undefined): boolean => {
  return Boolean(error && error.code === "PGRST205");
};

const markSupport = (supported: boolean) => {
  matchStatesSupported = supported;
};

const getClient = (): MatchStatesClient => supabase;

const persistWithMatchScores = async (state: GameState) => {
  const client = getClient();
  const scoreRows = mapGameStateToScoreRows(state);

  const { error: deleteError } = await client.from("match_scores").delete().eq("match_id", state.gameId);
  if (deleteError) {
    throw deleteError;
  }

  if (scoreRows.length > 0) {
    const { error: insertError } = await client.from("match_scores").insert(scoreRows);
    if (insertError) {
      throw insertError;
    }
  }

  markSupport(false);
  return { usedFallback: true } as const;
};

const loadFromMatchScores = async (matchId: string, game: Game) => {
  const client = getClient();
  const { data, error } = await client
    .from("match_scores")
    .select("*")
    .eq("match_id", matchId)
    .order("set_number", { ascending: true });

  if (error) {
    throw error;
  }

  markSupport(false);
  return { state: mapScoreRowsToGameState(data as MatchScoreRow[], game), usedFallback: true } as const;
};

export const isUsingMatchStateFallback = () => matchStatesSupported === false;

export const loadMatchState = async (matchId: string, game: Game) => {
  if (matchStatesSupported === false) {
    return loadFromMatchScores(matchId, game);
  }

  const client = getClient();
  const { data, error } = await client
    .from("match_states")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      return loadFromMatchScores(matchId, game);
    }
    throw error;
  }

  if (data) {
    markSupport(true);
    return { state: mapRowToGameState(data as MatchStateRow, game), usedFallback: false } as const;
  }

  const defaultState = createDefaultGameState(game);
  const payload = mapGameStateToRow(defaultState);
  const { error: upsertError } = await client
    .from("match_states")
    .upsert(payload, { onConflict: "match_id", returning: "minimal", ignoreDuplicates: false });

  if (upsertError) {
    if (isTableMissingError(upsertError)) {
      return loadFromMatchScores(matchId, game);
    }
    throw upsertError;
  }

  markSupport(true);
  return { state: defaultState, usedFallback: false } as const;
};

export const saveMatchState = async (state: GameState) => {
  if (matchStatesSupported === false) {
    return persistWithMatchScores(state);
  }

  const client = getClient();
  const payload = mapGameStateToRow(state);
  const { error } = await client
    .from("match_states")
    .upsert(payload, { onConflict: "match_id", returning: "minimal", ignoreDuplicates: false });

  if (!error) {
    markSupport(true);
    return { usedFallback: false } as const;
  }

  if (isTableMissingError(error)) {
    return persistWithMatchScores(state);
  }

  throw error;
};

export const loadMatchStates = async (matchIds: string[], configs: Record<string, Game>) => {
  if (!matchIds.length) {
    return { states: {}, usedFallback: matchStatesSupported === false } as const;
  }

  if (matchStatesSupported === false) {
    return loadMatchStatesFromScores(matchIds, configs);
  }

  const client = getClient();
  const { data, error } = await client.from("match_states").select("*").in("match_id", matchIds);

  if (error) {
    if (isTableMissingError(error)) {
      return loadMatchStatesFromScores(matchIds, configs);
    }
    throw error;
  }

  markSupport(true);

  const mapped: Record<string, GameState> = {};
  data?.forEach(row => {
    const config = configs[row.match_id as string];
    if (config) {
      mapped[row.match_id as string] = mapRowToGameState(row as MatchStateRow, config);
    }
  });

  matchIds.forEach(matchId => {
    if (!mapped[matchId] && configs[matchId]) {
      mapped[matchId] = createDefaultGameState(configs[matchId]);
    }
  });

  return { states: mapped, usedFallback: false } as const;
};

const loadMatchStatesFromScores = async (matchIds: string[], configs: Record<string, Game>) => {
  const client = getClient();
  const { data, error } = await client
    .from("match_scores")
    .select("*")
    .in("match_id", matchIds);

  if (error) {
    throw error;
  }

  const grouped = new Map<string, MatchScoreRow[]>();
  (data as MatchScoreRow[] | null | undefined)?.forEach(row => {
    if (!grouped.has(row.match_id)) {
      grouped.set(row.match_id, []);
    }
    grouped.get(row.match_id)!.push(row);
  });

  const states: Record<string, GameState> = {};
  matchIds.forEach(matchId => {
    const config = configs[matchId];
    if (!config) return;
    const rows = grouped.get(matchId) ?? [];
    states[matchId] = mapScoreRowsToGameState(rows, config);
  });

  markSupport(false);
  return { states, usedFallback: true } as const;
};

export const subscribeToMatchState = (
  matchId: string,
  game: Game,
  callback: (state: GameState) => void,
) => {
  const client = getClient();

  if (matchStatesSupported === false) {
    const channel = client
      .channel(`match-state-fallback-${matchId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "match_scores",
        filter: `match_id=eq.${matchId}`,
      }, async () => {
        const { data } = await client
          .from("match_scores")
          .select("*")
          .eq("match_id", matchId)
          .order("set_number", { ascending: true });
        callback(mapScoreRowsToGameState((data ?? []) as MatchScoreRow[], game));
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  const channel = client
    .channel(`match-state-${matchId}`)
    .on<MatchStateRow>("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "match_states",
      filter: `match_id=eq.${matchId}`,
    }, payload => {
      if (payload.new) {
        callback(mapRowToGameState(payload.new as MatchStateRow, game));
      }
    })
    .on<MatchStateRow>("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "match_states",
      filter: `match_id=eq.${matchId}`,
    }, payload => {
      if (payload.new) {
        callback(mapRowToGameState(payload.new as MatchStateRow, game));
      }
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};
