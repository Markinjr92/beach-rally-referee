import { Game, GameState, Timer } from "@/types/volleyball";
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

export const createDefaultGameState = (game: Game): GameState => {
  const sets = game.pointsPerSet?.length ?? 3;
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
    events: [],
    activeTimer: null,
    isGameEnded: false,
  };
};

export const mapRowToGameState = (row: MatchStateRow, game: Game): GameState => {
  const sets = game.pointsPerSet?.length ?? 3;
  const activeTimer = row.active_timer as (Record<string, any> | null) | undefined;

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
