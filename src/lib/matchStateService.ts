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

const persistWithMatchScores = async (state: GameState, isCasualMatch = false) => {
  const client = getClient();
  const scoreRows = mapGameStateToScoreRows(state, isCasualMatch);

  // Note: match_scores não suporta casual_match_id, então não persistimos scores para casual matches
  // quando usando fallback. Isso é uma limitação do sistema atual.
  if (!isCasualMatch) {
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
  }

  markSupport(false);
  return { usedFallback: true } as const;
};

const loadFromMatchScores = async (matchId: string, game: Game, isCasualMatch = false) => {
  // Casual matches não usam match_scores, então retornamos estado padrão
  if (isCasualMatch) {
    markSupport(false);
    return { state: createDefaultGameState(game), usedFallback: true } as const;
  }

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

export const loadMatchState = async (matchId: string, game: Game, isCasualMatch = false) => {
  if (matchStatesSupported === false) {
    return loadFromMatchScores(matchId, game, isCasualMatch);
  }

  const client = getClient();
  const query = client
    .from("match_states")
    .select("*");
  
  if (isCasualMatch) {
    query.eq("casual_match_id", matchId);
  } else {
    query.eq("match_id", matchId);
  }
  
  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      return loadFromMatchScores(matchId, game, isCasualMatch);
    }
    throw error;
  }

  if (data) {
    markSupport(true);
    return { state: mapRowToGameState(data as MatchStateRow, game), usedFallback: false } as const;
  }

  const defaultState = createDefaultGameState(game);
  const payload = mapGameStateToRow(defaultState, isCasualMatch ? matchId : undefined);
  
  // Para casual matches, usar abordagem diferente (INSERT, já que data é null)
  if (isCasualMatch) {
    // Inserir novo registro (não existe ainda, pois data é null na linha 93)
    const { error: insertError } = await client
      .from("match_states")
      .insert([payload]);

    if (insertError) {
      // Se for erro de constraint única (já existe - race condition), buscar novamente
      if (insertError.code === '23505') {
        const { data: retryData, error: retryError } = await client
          .from("match_states")
          .select("*")
          .eq("casual_match_id", matchId)
          .maybeSingle();
        
        if (!retryError && retryData) {
          markSupport(true);
          return { state: mapRowToGameState(retryData as MatchStateRow, game), usedFallback: false } as const;
        }
        // Se ainda der erro, continuar com o tratamento abaixo
      }
      
      if (isTableMissingError(insertError)) {
        return loadFromMatchScores(matchId, game, isCasualMatch);
      }
      // If it's a permission error (RLS), return default state without saving
      if (insertError.code === '42501') {
        markSupport(true);
        return { state: defaultState, usedFallback: false } as const;
      }
      // Para outros erros, logar mas retornar estado padrão (não travar)
      console.error('Erro ao inserir match_state para casual match:', insertError);
      markSupport(true);
      return { state: defaultState, usedFallback: false } as const;
    }

    markSupport(true);
    return { state: defaultState, usedFallback: false } as const;
  } else {
    // Para matches normais, usar SELECT + INSERT/UPDATE (mesma abordagem de casual matches)
    const { data: existingMatch, error: selectMatchError } = await client
      .from("match_states")
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();

    if (selectMatchError && !isTableMissingError(selectMatchError)) {
      if (selectMatchError.code === '42501') {
        // Permission error (RLS), retornar estado padrão sem salvar
        markSupport(true);
        return { state: defaultState, usedFallback: false } as const;
      }
      throw selectMatchError;
    }

    if (existingMatch && 'id' in existingMatch) {
      // Já existe, retornar estado padrão (será carregado na próxima vez)
      markSupport(true);
      return { state: defaultState, usedFallback: false } as const;
    } else {
      // Inserir novo registro
      const { error: insertError } = await client
        .from("match_states")
        .insert([payload]);

      if (!insertError) {
        markSupport(true);
        return { state: defaultState, usedFallback: false } as const;
      }

      if (isTableMissingError(insertError)) {
        return loadFromMatchScores(matchId, game, isCasualMatch);
      }

      // If it's a permission error (RLS), return default state without saving
      if (insertError.code === '42501') {
        markSupport(true);
        return { state: defaultState, usedFallback: false } as const;
      }

      // Se for erro de constraint única (race condition), buscar novamente
      if (insertError.code === '23505') {
        const { data: retryData, error: retryError } = await client
          .from("match_states")
          .select("*")
          .eq("match_id", matchId)
          .maybeSingle();
        
        if (!retryError && retryData && typeof retryData === 'object' && 'id' in retryData) {
          markSupport(true);
          return { state: mapRowToGameState(retryData as MatchStateRow, game), usedFallback: false } as const;
        }
      }

      // Para outros erros, logar mas retornar estado padrão (não travar)
      console.error('Erro ao inserir match_state para match normal:', insertError);
      markSupport(true);
      return { state: defaultState, usedFallback: false } as const;
    }
  }
};

export const saveMatchState = async (state: GameState, isCasualMatch = false) => {
  if (matchStatesSupported === false) {
    return persistWithMatchScores(state, isCasualMatch);
  }

  const client = getClient();
  const payload = mapGameStateToRow(state, isCasualMatch ? state.gameId : undefined);
  
  // Para casual matches, precisamos usar uma abordagem diferente porque
  // o Supabase não suporta onConflict com índices únicos parciais
  if (isCasualMatch) {
    // Verificar se já existe usando casual_match_id
    const { data: existing, error: selectError } = await client
      .from("match_states")
      .select("casual_match_id")
      .eq("casual_match_id", state.gameId)
      .maybeSingle();

    if (selectError && !isTableMissingError(selectError)) {
      throw selectError;
    }

    if (existing) {
      // Atualizar registro existente usando casual_match_id
      const { error } = await client
        .from("match_states")
        .update(payload)
        .eq("casual_match_id", state.gameId);

      if (!error) {
        markSupport(true);
        return { usedFallback: false } as const;
      }
      throw error;
    } else {
      // Inserir novo registro
      const { error } = await client
        .from("match_states")
        .insert([payload]);

      if (!error) {
        markSupport(true);
        return { usedFallback: false } as const;
      }
      
      // Se for erro de constraint única (race condition), tentar atualizar
      if (error.code === '23505') {
        const { error: updateError } = await client
          .from("match_states")
          .update(payload)
          .eq("casual_match_id", state.gameId);
        
        if (!updateError) {
          markSupport(true);
          return { usedFallback: false } as const;
        }
      }
      
      throw error;
    }
  } else {
    // Para matches normais, usar SELECT + UPDATE/INSERT (mesma abordagem de casual matches)
    // Isso evita problemas com índices únicos parciais no Supabase PostgREST
    const { data: existing, error: selectError } = await client
      .from("match_states")
      .select("id")
      .eq("match_id", state.gameId)
      .maybeSingle();

    if (selectError && !isTableMissingError(selectError)) {
      throw selectError;
    }

    if (existing && existing !== null) {
      // Atualizar registro existente usando o id
      const existingId = (existing as { id?: string }).id;
      if (!existingId) {
        throw new Error('Existing record found but missing id');
      }
      const { error } = await client
        .from("match_states")
        .update(payload)
        .eq("id", existingId);

      if (!error) {
        markSupport(true);
        return { usedFallback: false } as const;
      }
      
      if (isTableMissingError(error)) {
        return persistWithMatchScores(state, isCasualMatch);
      }
      
      throw error;
    } else {
      // Inserir novo registro
      const { error } = await client
        .from("match_states")
        .insert([payload]);

      if (!error) {
        markSupport(true);
        return { usedFallback: false } as const;
      }
      
      if (isTableMissingError(error)) {
        return persistWithMatchScores(state, isCasualMatch);
      }
      
      // Se for erro de constraint única (race condition), tentar atualizar
      if (error.code === '23505') {
        const { data: retryData, error: retryError } = await client
          .from("match_states")
          .select("id")
          .eq("match_id", state.gameId)
          .maybeSingle();
        
        if (!retryError && retryData && retryData !== null) {
          const retryId = (retryData as { id?: string }).id;
          if (!retryId) {
            throw error; // Se não tem id, re-throw o erro original
          }
          const { error: updateError } = await client
            .from("match_states")
            .update(payload)
            .eq("id", retryId);
          
          if (!updateError) {
            markSupport(true);
            return { usedFallback: false } as const;
          }
        }
      }
      
      throw error;
    }
  }
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
  isCasualMatch = false,
) => {
  const client = getClient();

  if (matchStatesSupported === false) {
    // Casual matches não usam match_scores fallback
    if (isCasualMatch) {
      // Retornar função vazia, não há fallback para casual matches
      return () => {};
    }
    
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

  const filterField = isCasualMatch ? "casual_match_id" : "match_id";
  const channel = client
    .channel(`match-state-${matchId}`)
    .on<MatchStateRow>("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "match_states",
      filter: `${filterField}=eq.${matchId}`,
    }, payload => {
      if (payload.new) {
        callback(mapRowToGameState(payload.new as MatchStateRow, game));
      }
    })
    .on<MatchStateRow>("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "match_states",
      filter: `${filterField}=eq.${matchId}`,
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
