import {
  CoinChoice,
  CourtSide,
  Game,
  GameState,
  SetConfiguration,
  TeamSetConfiguration,
  Timer,
} from "@/types/volleyball";
import { Tables, TablesInsert, Database } from "@/integrations/supabase/types";

type Json = Database['public']['Tables']['match_states']['Row']['scores'];

export type MatchStateRow = Tables<"match_states">;
export type MatchTimeoutRow = Tables<"match_timeouts">;
export type MatchScoreRow = Tables<"match_scores">;
export type MatchScoreInsert = TablesInsert<"match_scores">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const parseNumberArrayWithFallback = (value: unknown, fallback: number[]): number[] => {
  const fallbackLast = fallback[fallback.length - 1] ?? 0;
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const result = value.map((item, index) => {
    const fallbackValue = fallback[index] ?? fallbackLast;
    return parseNumber(item, fallbackValue);
  });
  if (result.length < fallback.length) {
    return [...result, ...fallback.slice(result.length)];
  }
  return result;
};

const parseBooleanArrayWithFallback = (value: unknown, fallback: boolean[]): boolean[] => {
  const fallbackLast = fallback[fallback.length - 1] ?? false;
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const result = value.map((item, index) => {
    const fallbackValue = fallback[index] ?? fallbackLast;
    return parseBoolean(item, fallbackValue);
  });
  if (result.length < fallback.length) {
    return [...result, ...fallback.slice(result.length)];
  }
  return result;
};

const parseTeamNumberArrayRecord = (
  value: unknown,
  fallback: { teamA: number[]; teamB: number[] }
): { teamA: number[]; teamB: number[] } => {
  if (!isRecord(value)) {
    return { teamA: [...fallback.teamA], teamB: [...fallback.teamB] };
  }
  return {
    teamA: parseNumberArrayWithFallback(value.teamA, fallback.teamA),
    teamB: parseNumberArrayWithFallback(value.teamB, fallback.teamB),
  };
};

const parseTeamCountRecord = (
  value: unknown,
  fallback: { teamA: number; teamB: number }
): { teamA: number; teamB: number } => {
  if (!isRecord(value)) {
    return { ...fallback };
  }
  return {
    teamA: parseNumber(value.teamA, fallback.teamA),
    teamB: parseNumber(value.teamB, fallback.teamB),
  };
};

const parseTeamIdentifier = (value: unknown, fallback: "A" | "B"): "A" | "B" =>
  value === "B" ? "B" : fallback;

const parseCoinChoiceValue = (value: unknown, fallback: CoinChoice): CoinChoice =>
  value === "serve" || value === "receive" || value === "side" ? value : fallback;

const parseCourtSideValue = (
  value: unknown,
  fallback: CourtSide
): CourtSide => (value === "right" ? "right" : fallback);

const parseOptionalCourtSideValue = (
  value: unknown,
  fallback: CourtSide | undefined
): CourtSide | undefined => {
  if (value === "left" || value === "right") {
    return value;
  }
  return fallback;
};

const timerTypes: readonly Timer["type"][] = [
  "TIMEOUT_TEAM",
  "TIMEOUT_TECHNICAL",
  "SET_INTERVAL",
  "MEDICAL",
];

const parseTimer = (value: unknown): Timer | null => {
  if (!isRecord(value) || value.id === undefined) {
    return null;
  }

  const typeCandidate = typeof value.type === "string" ? (value.type as Timer["type"]) : undefined;
  const type = timerTypes.includes(typeCandidate ?? "TIMEOUT_TEAM")
    ? typeCandidate ?? "TIMEOUT_TEAM"
    : "TIMEOUT_TEAM";

  const startedAt =
    typeof value.startedAt === "string"
      ? value.startedAt
      : typeof value.started_at === "string"
      ? value.started_at
      : new Date().toISOString();
  const endsAt =
    typeof value.endsAt === "string"
      ? value.endsAt
      : typeof value.ends_at === "string"
      ? value.ends_at
      : new Date().toISOString();
  const durationSec = parseNumber(value.durationSec ?? value.duration_seconds, 0);
  const team = value.team === "A" || value.team === "B" ? value.team : undefined;

  return {
    id: String(value.id),
    type,
    startedAt,
    endsAt,
    durationSec,
    team,
  };
};

type StoredTeamSetConfiguration = {
  jerseyAssignment?: Record<string, unknown>;
  serviceOrder?: unknown;
};

type StoredSetConfiguration = Partial<Omit<SetConfiguration, "teams" | "coinToss">> & {
  coinToss?: Partial<SetConfiguration["coinToss"]>;
  teams?: {
    teamA?: StoredTeamSetConfiguration;
    teamB?: StoredTeamSetConfiguration;
  };
};

const isStoredSetConfiguration = (value: unknown): value is StoredSetConfiguration =>
  isRecord(value);

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

const mergeTeamConfiguration = (
  game: Game,
  team: "A" | "B",
  config: StoredTeamSetConfiguration | undefined
): TeamSetConfiguration => {
  const defaultConfig = buildDefaultTeamConfiguration(game, team);
  if (!config) {
    return defaultConfig;
  }

  const jerseyAssignment = { ...defaultConfig.jerseyAssignment };
  if (isRecord(config.jerseyAssignment)) {
    Object.entries(config.jerseyAssignment).forEach(([key, value]) => {
      jerseyAssignment[key] = parseNumber(value, jerseyAssignment[key] ?? 0);
    });
  }

  const serviceOrder = parseNumberArrayWithFallback(
    config.serviceOrder,
    defaultConfig.serviceOrder
  );

  return {
    jerseyAssignment,
    serviceOrder,
  };
};

const parseSetConfigurations = (
  stored: unknown,
  defaultConfigs: SetConfiguration[],
  game: Game
): SetConfiguration[] => {
  if (!Array.isArray(stored)) {
    return defaultConfigs;
  }

  return defaultConfigs.map((defaultConfig, index) => {
    const candidate = stored[index];
    if (!isStoredSetConfiguration(candidate)) {
      return defaultConfig;
    }

    const coinToss = candidate.coinToss ?? {};
    const teams = candidate.teams ?? {};

    const startingServerTeam = parseTeamIdentifier(
      candidate.startingServerTeam,
      defaultConfig.startingServerTeam
    );

    const startingReceiverTeam = parseTeamIdentifier(
      candidate.startingReceiverTeam,
      startingServerTeam === "A" ? "B" : "A"
    );

    return {
      setNumber: parseNumber(candidate.setNumber, defaultConfig.setNumber),
      isConfigured:
        typeof candidate.isConfigured === "boolean"
          ? candidate.isConfigured
          : defaultConfig.isConfigured,
      firstChoiceTeam: parseTeamIdentifier(
        candidate.firstChoiceTeam,
        defaultConfig.firstChoiceTeam
      ),
      firstChoiceOption: parseCoinChoiceValue(
        candidate.firstChoiceOption,
        defaultConfig.firstChoiceOption
      ),
      firstChoiceSide: parseOptionalCourtSideValue(
        candidate.firstChoiceSide,
        defaultConfig.firstChoiceSide
      ),
      secondChoiceOption: parseCoinChoiceValue(
        candidate.secondChoiceOption,
        defaultConfig.secondChoiceOption
      ),
      secondChoiceSide: parseOptionalCourtSideValue(
        candidate.secondChoiceSide,
        defaultConfig.secondChoiceSide
      ),
      sideChoiceTeam: parseTeamIdentifier(
        candidate.sideChoiceTeam,
        defaultConfig.sideChoiceTeam
      ),
      sideSelection: parseCourtSideValue(
        candidate.sideSelection,
        defaultConfig.sideSelection
      ),
      startingServerTeam,
      startingReceiverTeam,
      startingServerPlayer: parseNumber(
        candidate.startingServerPlayer,
        defaultConfig.startingServerPlayer
      ),
      coinToss: {
        performed:
          typeof coinToss.performed === "boolean"
            ? coinToss.performed
            : defaultConfig.coinToss.performed,
        winner:
          coinToss.winner === "A" || coinToss.winner === "B"
            ? coinToss.winner
            : defaultConfig.coinToss.winner,
        loser:
          coinToss.loser === "A" || coinToss.loser === "B"
            ? coinToss.loser
            : defaultConfig.coinToss.loser,
      },
      teams: {
        teamA: mergeTeamConfiguration(game, "A", teams.teamA),
        teamB: mergeTeamConfiguration(game, "B", teams.teamB),
      },
    } satisfies SetConfiguration;
  });
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
  const defaultState = createDefaultGameState(game);
  const sets = game.pointsPerSet?.length ?? defaultState.scores.teamA.length;

  const parsedTimer = parseTimer(row.active_timer ?? null);
  const serviceOrders = parseTeamNumberArrayRecord(
    row.service_orders,
    defaultState.serviceOrders
  );
  const nextServerIndex = parseTeamCountRecord(
    row.next_server_index,
    defaultState.nextServerIndex
  );
  const setConfigurations = parseSetConfigurations(
    row.set_configurations,
    defaultState.setConfigurations,
    game
  );

  const scores = parseTeamNumberArrayRecord(row.scores, {
    teamA: Array.from({ length: sets }, () => 0),
    teamB: Array.from({ length: sets }, () => 0),
  });
  const timeoutsUsed = parseTeamNumberArrayRecord(row.timeouts_used, {
    teamA: Array.from({ length: sets }, () => 0),
    teamB: Array.from({ length: sets }, () => 0),
  });
  const technicalTimeoutUsed = parseBooleanArrayWithFallback(
    row.technical_timeout_used,
    Array.from({ length: sets }, () => false)
  );
  const sidesSwitched = parseNumberArrayWithFallback(
    row.sides_switched,
    Array.from({ length: sets }, () => 0)
  );
  const setsWon = parseTeamCountRecord(row.sets_won, defaultState.setsWon);

  const gameId = row.casual_match_id || row.match_id || '';
  
  return {
    ...defaultState,
    id: `${gameId}-state`,
    gameId,
    currentSet: row.current_set ?? defaultState.currentSet,
    setsWon,
    scores,
    currentServerTeam: (row.current_server_team as "A" | "B") ?? defaultState.currentServerTeam,
    currentServerPlayer: row.current_server_player ?? defaultState.currentServerPlayer,
    possession: (row.possession as "A" | "B") ?? defaultState.possession,
    leftIsTeamA: row.left_is_team_a ?? defaultState.leftIsTeamA,
    timeoutsUsed,
    technicalTimeoutUsed,
    sidesSwitched,
    serviceOrders,
    nextServerIndex,
    setConfigurations,
    events: [],
    activeTimer: parsedTimer,
    isGameEnded: row.is_game_ended ?? defaultState.isGameEnded,
  };
};

export const mapGameStateToRow = (state: GameState, casualMatchId?: string): TablesInsert<"match_states"> => {
  const row: TablesInsert<"match_states"> = {
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
    set_configurations: state.setConfigurations as unknown as Json,
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

  if (casualMatchId) {
    row.casual_match_id = casualMatchId;
    // match_id será null para casual matches (permitido agora)
    row.match_id = null;
  } else {
    row.match_id = state.gameId;
    row.casual_match_id = null;
  }

  // id será gerado automaticamente pelo banco se não fornecido
  // Não precisamos definir id aqui, o banco gera automaticamente

  return row;
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

export const mapGameStateToScoreRows = (state: GameState, isCasualMatch = false): MatchScoreInsert[] => {
  // Casual matches não usam match_scores
  if (isCasualMatch) {
    return [];
  }

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
