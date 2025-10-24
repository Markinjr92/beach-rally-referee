import {
  Game,
  GameState,
  SetConfiguration,
  TeamSetConfiguration,
  Timer,
} from "@/types/volleyball";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type MatchStateRow = Tables<"match_states">;
export type MatchTimeoutRow = Tables<"match_timeouts">;
export type MatchScoreRow = Tables<"match_scores">;
export type MatchScoreInsert = TablesInsert<"match_scores">;

const ensureArray = <T>(value: T[] | null | undefined, fallbackLength: number, fallbackValue: T) => {
  if (Array.isArray(value) && value.length >= fallbackLength) {
    return [...value];
  }
  return Array.from({ length: fallbackLength }, () => fallbackValue);
};

const buildDefaultServiceOrder = (game: Game, team: "A" | "B"): number[] => {
  const players = team === "A" ? game.teamA.players : game.teamB.players;
  if (!players || players.length === 0) {
    return [1, 2];
  }
  return players.map((_, index) => index + 1);
};

const buildDefaultTeamConfiguration = (game: Game, team: "A" | "B"): TeamSetConfiguration => {
  const players = team === "A" ? game.teamA.players : game.teamB.players;
  const assignment: Record<string, number> = {};
  players.forEach((_, index) => {
    assignment[String(index + 1)] = index;
  });

  return {
    jerseyAssignment: assignment,
    serviceOrder: buildDefaultServiceOrder(game, team),
  };
};

const buildDefaultSetConfigurations = (game: Game, sets: number): SetConfiguration[] => {
  return Array.from({ length: sets }, (_, index) => {
    const setNumber = index + 1;
    return {
      setNumber,
      isConfigured: false,
      firstChoiceTeam: "A",
      firstChoiceOption: "serve",
      secondChoiceOption: "side",
      sideChoiceTeam: "B",
      sideSelection: "left",
      startingServerTeam: "A",
      startingReceiverTeam: "B",
      startingServerPlayer: 1,
      coinToss: {
        performed: false,
        winner: undefined,
        loser: undefined,
      },
      teams: {
        teamA: buildDefaultTeamConfiguration(game, "A"),
        teamB: buildDefaultTeamConfiguration(game, "B"),
      },
    } satisfies SetConfiguration;
  });
};

export const createDefaultGameState = (game: Game): GameState => {
  const sets = game.pointsPerSet?.length ?? 3;
  const defaultSetConfigurations = buildDefaultSetConfigurations(game, sets);
  return {
    id: `${game.id}-state`,
    gameId: game.id,
    currentSet: 1,
    setsWon: { teamA: 0, teamB: 0 },
    scores: {
      teamA: Array.from({ length: sets }, () => 0),
      teamB: Array.from({ length: sets }, () => 0),
    },
    currentServerTeam: "A",
    currentServerPlayer: 1,
    possession: "A",
    leftIsTeamA: true,
    timeoutsUsed: {
      teamA: Array.from({ length: sets }, () => 0),
      teamB: Array.from({ length: sets }, () => 0),
    },
    technicalTimeoutUsed: Array.from({ length: sets }, () => false),
    sidesSwitched: Array.from({ length: sets }, () => 0),
    serviceOrders: {
      teamA: buildDefaultServiceOrder(game, "A"),
      teamB: buildDefaultServiceOrder(game, "B"),
    },
    nextServerIndex: { teamA: 0, teamB: 0 },
    setConfigurations: defaultSetConfigurations,
    events: [],
    activeTimer: null,
    isGameEnded: false,
  };
};

export const mapRowToGameState = (row: MatchStateRow, game: Game): GameState => {
  const sets = game.pointsPerSet?.length ?? 3;
  const activeTimer = row.active_timer as (Record<string, any> | null) | undefined;
  const storedServiceOrders = (row.service_orders as
    | { teamA?: number[]; teamB?: number[] }
    | null
    | undefined) ?? null;
  const storedNextServerIndex = (row.next_server_index as
    | { teamA?: number; teamB?: number }
    | null
    | undefined) ?? null;
  const storedConfigurations = (row.set_configurations as any as SetConfiguration[] | undefined) ?? undefined;

  let timer: Timer | null = null;
  if (activeTimer && typeof activeTimer === "object" && activeTimer.id) {
    timer = {
      id: String(activeTimer.id),
      type: (activeTimer.type as Timer["type"]) ?? "TIMEOUT_TEAM",
      startedAt: String(activeTimer.startedAt ?? activeTimer.started_at ?? new Date().toISOString()),
      endsAt: String(activeTimer.endsAt ?? activeTimer.ends_at ?? new Date().toISOString()),
      durationSec: Number(activeTimer.durationSec ?? activeTimer.duration_seconds ?? 0),
      team: activeTimer.team === "A" || activeTimer.team === "B" ? activeTimer.team : undefined,
    };
  }

  const defaultState = createDefaultGameState(game);

  const mergeTeamConfiguration = (config: TeamSetConfiguration | undefined, team: "A" | "B"): TeamSetConfiguration => {
    if (!config) {
      return buildDefaultTeamConfiguration(game, team);
    }

    const jerseyAssignment: Record<string, number> = {};
    Object.entries(config.jerseyAssignment ?? {}).forEach(([key, value]) => {
      jerseyAssignment[key] = Number(value);
    });

    const serviceOrder = Array.isArray(config.serviceOrder) && config.serviceOrder.length
      ? config.serviceOrder.map(Number)
      : buildDefaultServiceOrder(game, team);

    return {
      jerseyAssignment,
      serviceOrder,
    };
  };

  const setConfigurations: SetConfiguration[] = defaultState.setConfigurations.map((defaultConfig, index) => {
    const storedConfig = storedConfigurations?.[index];
    if (!storedConfig) {
      return defaultConfig;
    }

    const coinToss = storedConfig.coinToss ?? defaultConfig.coinToss;
    const firstChoiceTeam = storedConfig.firstChoiceTeam ?? defaultConfig.firstChoiceTeam;
    const startingServerTeam = storedConfig.startingServerTeam ?? defaultConfig.startingServerTeam;
    const startingReceiverTeam = storedConfig.startingReceiverTeam ?? (startingServerTeam === "A" ? "B" : "A");
    const sideChoiceTeam = storedConfig.sideChoiceTeam ?? defaultConfig.sideChoiceTeam;

    return {
      setNumber: storedConfig.setNumber ?? defaultConfig.setNumber,
      isConfigured: storedConfig.isConfigured ?? defaultConfig.isConfigured,
      firstChoiceTeam,
      firstChoiceOption: storedConfig.firstChoiceOption ?? defaultConfig.firstChoiceOption,
      firstChoiceSide: storedConfig.firstChoiceSide ?? defaultConfig.firstChoiceSide,
      secondChoiceOption: storedConfig.secondChoiceOption ?? defaultConfig.secondChoiceOption,
      secondChoiceSide: storedConfig.secondChoiceSide ?? defaultConfig.secondChoiceSide,
      sideChoiceTeam,
      sideSelection: storedConfig.sideSelection ?? defaultConfig.sideSelection,
      startingServerTeam,
      startingReceiverTeam,
      startingServerPlayer: storedConfig.startingServerPlayer ?? defaultConfig.startingServerPlayer,
      coinToss: {
        performed: coinToss?.performed ?? defaultConfig.coinToss.performed,
        winner: coinToss?.winner ?? defaultConfig.coinToss.winner,
        loser: coinToss?.loser ?? defaultConfig.coinToss.loser,
      },
      teams: {
        teamA: mergeTeamConfiguration(storedConfig.teams?.teamA, "A"),
        teamB: mergeTeamConfiguration(storedConfig.teams?.teamB, "B"),
      },
    };
  });

  return {
    id: `${row.match_id}-state`,
    gameId: row.match_id,
    currentSet: row.current_set ?? 1,
    setsWon: {
      teamA: Number((row.sets_won as any)?.teamA ?? 0),
      teamB: Number((row.sets_won as any)?.teamB ?? 0),
    },
    scores: {
      teamA: ensureArray<number>((row.scores as any)?.teamA, sets, 0).map(Number),
      teamB: ensureArray<number>((row.scores as any)?.teamB, sets, 0).map(Number),
    },
    currentServerTeam: (row.current_server_team as "A" | "B") ?? "A",
    currentServerPlayer: row.current_server_player ?? 1,
    possession: (row.possession as "A" | "B") ?? "A",
    leftIsTeamA: row.left_is_team_a ?? true,
    timeoutsUsed: {
      teamA: ensureArray<number>((row.timeouts_used as any)?.teamA, sets, 0).map(Number),
      teamB: ensureArray<number>((row.timeouts_used as any)?.teamB, sets, 0).map(Number),
    },
    technicalTimeoutUsed: ensureArray<boolean>(row.technical_timeout_used as any, sets, false).map(Boolean),
    sidesSwitched: ensureArray<number>(row.sides_switched as any, sets, 0).map(Number),
    serviceOrders: {
      teamA: Array.isArray(storedServiceOrders?.teamA) && storedServiceOrders?.teamA.length
        ? storedServiceOrders.teamA.map(Number)
        : defaultState.serviceOrders.teamA,
      teamB: Array.isArray(storedServiceOrders?.teamB) && storedServiceOrders?.teamB.length
        ? storedServiceOrders.teamB.map(Number)
        : defaultState.serviceOrders.teamB,
    },
    nextServerIndex: {
      teamA: Number(storedNextServerIndex?.teamA ?? defaultState.nextServerIndex.teamA),
      teamB: Number(storedNextServerIndex?.teamB ?? defaultState.nextServerIndex.teamB),
    },
    setConfigurations,
    events: [],
    activeTimer: timer,
    isGameEnded: row.is_game_ended ?? false,
  };
};

export const mapGameStateToRow = (state: GameState): TablesInsert<"match_states"> => {
  return {
    match_id: state.gameId,
    current_set: state.currentSet,
    sets_won: { teamA: state.setsWon.teamA, teamB: state.setsWon.teamB },
    scores: {
      teamA: state.scores.teamA,
      teamB: state.scores.teamB,
    },
    current_server_team: state.currentServerTeam,
    current_server_player: state.currentServerPlayer,
    possession: state.possession,
    left_is_team_a: state.leftIsTeamA,
    timeouts_used: {
      teamA: state.timeoutsUsed.teamA,
      teamB: state.timeoutsUsed.teamB,
    },
    technical_timeout_used: state.technicalTimeoutUsed,
    sides_switched: state.sidesSwitched,
    service_orders: {
      teamA: state.serviceOrders.teamA,
      teamB: state.serviceOrders.teamB,
    },
    next_server_index: {
      teamA: state.nextServerIndex.teamA,
      teamB: state.nextServerIndex.teamB,
    },
    set_configurations: state.setConfigurations,
    active_timer: state.activeTimer
      ? {
          id: state.activeTimer.id,
          type: state.activeTimer.type,
          startedAt: state.activeTimer.startedAt,
          endsAt: state.activeTimer.endsAt,
          durationSec: state.activeTimer.durationSec,
          team: state.activeTimer.team ?? null,
        }
      : null,
    is_game_ended: state.isGameEnded,
  };
};

const getSetTargetPoints = (game: Game, setIndex: number) => {
  const pointsPerSet = game.pointsPerSet ?? [];
  if (pointsPerSet.length === 0) {
    return 21;
  }
  const clampedIndex = Math.min(setIndex, pointsPerSet.length - 1);
  return pointsPerSet[clampedIndex] ?? pointsPerSet[pointsPerSet.length - 1] ?? 21;
};

const getSetsToWin = (game: Game) => {
  const sets = game.pointsPerSet?.length ?? 3;
  return Math.floor(sets / 2) + 1;
};

export const mapScoreRowsToGameState = (rows: MatchScoreRow[] | null | undefined, game: Game): GameState => {
  const state = createDefaultGameState(game);
  if (!rows || rows.length === 0) {
    return state;
  }

  const sortedRows = [...rows].sort((a, b) => a.set_number - b.set_number);
  const totalSets = game.pointsPerSet?.length ?? state.scores.teamA.length;
  let highestSetNumber = 1;

  sortedRows.forEach(row => {
    const setIndex = Math.min(Math.max(row.set_number - 1, 0), totalSets - 1);
    highestSetNumber = Math.max(highestSetNumber, row.set_number);

    state.scores.teamA[setIndex] = row.team_a_points;
    state.scores.teamB[setIndex] = row.team_b_points;

    const targetPoints = getSetTargetPoints(game, setIndex);
    const difference = Math.abs(row.team_a_points - row.team_b_points);
    const hasWinner = difference >= 2 && (row.team_a_points >= targetPoints || row.team_b_points >= targetPoints);

    if (hasWinner) {
      if (row.team_a_points > row.team_b_points) {
        state.setsWon.teamA += 1;
      } else {
        state.setsWon.teamB += 1;
      }
    }
  });

  const setsToWin = getSetsToWin(game);
  if (state.setsWon.teamA >= setsToWin || state.setsWon.teamB >= setsToWin) {
    state.isGameEnded = true;
    state.currentSet = Math.min(highestSetNumber, totalSets);
  } else {
    state.currentSet = Math.min(Math.max(highestSetNumber, 1), totalSets);
  }

  return state;
};

export const mapGameStateToScoreRows = (state: GameState): MatchScoreInsert[] => {
  const rows: MatchScoreInsert[] = [];
  const totalSets = Math.max(state.scores.teamA.length, state.scores.teamB.length);
  for (let index = 0; index < totalSets; index += 1) {
    const teamAPoints = state.scores.teamA[index] ?? 0;
    const teamBPoints = state.scores.teamB[index] ?? 0;
    const isCompletedSet = index < state.currentSet - 1;
    const isCurrentSet = index === state.currentSet - 1;
    const hasScore = teamAPoints > 0 || teamBPoints > 0;
    if (!isCompletedSet && !hasScore && !isCurrentSet) {
      continue;
    }

    rows.push({
      match_id: state.gameId,
      set_number: index + 1,
      team_a_points: teamAPoints,
      team_b_points: teamBPoints,
    });
  }

  return rows;
};

export const buildTimer = (params: {
  id: string;
  type: Timer["type"];
  startedAt: string;
  durationSec: number;
  team?: 'A' | 'B';
}): Timer => {
  const { id, type, startedAt, durationSec, team } = params;
  const endsAt = new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString();
  return {
    id,
    type,
    startedAt,
    endsAt,
    durationSec,
    team,
  };
};

export const calculateRemainingSeconds = (timer: Timer | null | undefined) => {
  if (!timer) return 0;
  const endsAtMs = new Date(timer.endsAt).getTime();
  const diff = Math.ceil((endsAtMs - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
};
