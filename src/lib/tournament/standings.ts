import {
  TournamentGroup,
  TournamentMatch,
  TournamentStanding,
  TournamentTeam,
  TieBreakerCriterion,
} from '@/types/volleyball';

import { defaultTieBreakerOrder } from './formats';
import { calculateMatchPoints, summarizeSets } from './scoring';

interface BaseStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  matchPoints: number;
}

interface AggregatedStats extends BaseStats {
  teamId: string;
  seed: number;
  teamName: string;
  tieBreakValues: Partial<Record<TieBreakerCriterion, number>>;
}

interface CriterionValues {
  values: Partial<Record<string, number>>;
  applied: boolean;
}

export interface GroupStandingsOptions {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  group: TournamentGroup;
  tieBreakerOrder?: TieBreakerCriterion[];
}

export interface PhaseStandingsOptions {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  phaseId: string;
  tieBreakerOrder?: TieBreakerCriterion[];
}

const ZERO_STATS: BaseStats = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  setsWon: 0,
  setsLost: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  matchPoints: 0,
};

const cloneZeroStats = (): BaseStats => ({ ...ZERO_STATS });

const deterministicDrawValue = (seed: number, teamId: string) => {
  let hash = seed;
  for (let index = 0; index < teamId.length; index += 1) {
    hash = (hash * 31 + teamId.charCodeAt(index)) % 1000000007;
  }
  return hash / 1000000007;
};

const computeAverage = (won: number, lost: number) => {
  if (won === 0 && lost === 0) return 0;
  if (lost === 0) return Number.POSITIVE_INFINITY;
  return won / lost;
};

const ensureStandingEntry = (
  map: Map<string, AggregatedStats>,
  team: TournamentTeam,
): AggregatedStats => {
  if (map.has(team.id)) {
    return map.get(team.id)!;
  }
  const entry: AggregatedStats = {
    teamId: team.id,
    seed: team.seed,
    teamName: team.team.name,
    ...cloneZeroStats(),
    tieBreakValues: {},
  };
  map.set(team.id, entry);
  return entry;
};

const aggregateMatchStats = (
  match: TournamentMatch,
  map: Map<string, AggregatedStats>,
  teamsMap: Map<string, TournamentTeam>,
) => {
  if (!match.result || !match.teamAId || !match.teamBId) {
    return;
  }

  const teamAEntry = teamsMap.get(match.teamAId);
  const teamBEntry = teamsMap.get(match.teamBId);
  if (!teamAEntry || !teamBEntry) {
    return;
  }

  const standingA = ensureStandingEntry(map, teamAEntry);
  const standingB = ensureStandingEntry(map, teamBEntry);

  const result = match.result;
  const { setsWonA, setsWonB, pointsScoredA, pointsScoredB } = summarizeSets(result);
  const matchPoints = calculateMatchPoints(result);

  standingA.matchesPlayed += 1;
  standingB.matchesPlayed += 1;
  standingA.setsWon += setsWonA;
  standingA.setsLost += setsWonB;
  standingB.setsWon += setsWonB;
  standingB.setsLost += setsWonA;
  standingA.pointsFor += pointsScoredA;
  standingA.pointsAgainst += pointsScoredB;
  standingB.pointsFor += pointsScoredB;
  standingB.pointsAgainst += pointsScoredA;
  standingA.matchPoints += matchPoints.teamA;
  standingB.matchPoints += matchPoints.teamB;

  if (result.winner === 'A') {
    standingA.wins += 1;
    standingB.losses += 1;
  } else {
    standingB.wins += 1;
    standingA.losses += 1;
  }
};

const aggregateStatsForScope = (
  matches: TournamentMatch[],
  teams: TournamentTeam[],
  teamIds: string[],
): AggregatedStats[] => {
  const teamsMap = new Map(teams.map((team) => [team.id, team]));
  const statsMap = new Map<string, AggregatedStats>();

  matches.forEach((match) => aggregateMatchStats(match, statsMap, teamsMap));

  teamIds.forEach((teamId) => {
    const team = teamsMap.get(teamId);
    if (!team) {
      throw new Error(`Equipe ${teamId} não foi encontrada na lista do torneio.`);
    }
    ensureStandingEntry(statsMap, team);
  });

  return teamIds.map((teamId) => statsMap.get(teamId)!);
};

const aggregateStatsForTeam = (
  matches: TournamentMatch[],
  teamId: string,
  opponentsFilter?: Set<string>,
): BaseStats => {
  const stats = cloneZeroStats();

  matches.forEach((match) => {
    if (!match.result || !match.teamAId || !match.teamBId) {
      return;
    }

    const isTeamA = match.teamAId === teamId;
    const isTeamB = match.teamBId === teamId;

    if (!isTeamA && !isTeamB) {
      return;
    }

    const opponentId = isTeamA ? match.teamBId : match.teamAId;
    if (opponentsFilter && (!opponentId || !opponentsFilter.has(opponentId))) {
      return;
    }

    if (!opponentId) {
      return;
    }

    const result = match.result;
    const { setsWonA, setsWonB, pointsScoredA, pointsScoredB } = summarizeSets(result);
    const matchPoints = calculateMatchPoints(result);

    stats.matchesPlayed += 1;

    if (isTeamA) {
      stats.setsWon += setsWonA;
      stats.setsLost += setsWonB;
      stats.pointsFor += pointsScoredA;
      stats.pointsAgainst += pointsScoredB;
      stats.matchPoints += matchPoints.teamA;
      if (result.winner === 'A') stats.wins += 1;
      else stats.losses += 1;
    } else {
      stats.setsWon += setsWonB;
      stats.setsLost += setsWonA;
      stats.pointsFor += pointsScoredB;
      stats.pointsAgainst += pointsScoredA;
      stats.matchPoints += matchPoints.teamB;
      if (result.winner === 'B') stats.wins += 1;
      else stats.losses += 1;
    }
  });

  return stats;
};

const computeCriterionValues = (
  criterion: TieBreakerCriterion,
  group: AggregatedStats[],
  matches: TournamentMatch[],
): CriterionValues => {
  const values: Partial<Record<string, number>> = {};

  if (criterion === 'head_to_head') {
    if (group.length !== 2) {
      return { values: {}, applied: false };
    }

    const [teamA, teamB] = group;
    const directMatch = matches.find(
      (match) =>
        match.result &&
        ((match.teamAId === teamA.teamId && match.teamBId === teamB.teamId) ||
          (match.teamAId === teamB.teamId && match.teamBId === teamA.teamId)),
    );

    if (!directMatch || !directMatch.result) {
      return { values: {}, applied: false };
    }

    if (!directMatch.teamAId || !directMatch.teamBId) {
      return { values: {}, applied: false };
    }

    if (directMatch.result.winner === 'A') {
      values[directMatch.teamAId] = 1;
      values[directMatch.teamBId] = 0;
    } else {
      values[directMatch.teamBId] = 1;
      values[directMatch.teamAId] = 0;
    }

    return { values, applied: true };
  }

  if (criterion === 'sets_average_inner' || criterion === 'points_average_inner') {
    const opponentSet = new Set(group.map((item) => item.teamId));
    group.forEach((team) => {
      const stats = aggregateStatsForTeam(matches, team.teamId, opponentSet);
      if (criterion === 'sets_average_inner') {
        values[team.teamId] = computeAverage(stats.setsWon, stats.setsLost);
      } else {
        values[team.teamId] = computeAverage(stats.pointsFor, stats.pointsAgainst);
      }
    });
    return { values, applied: true };
  }

  if (criterion === 'sets_average_global') {
    group.forEach((team) => {
      values[team.teamId] = computeAverage(team.setsWon, team.setsLost);
    });
    return { values, applied: true };
  }

  if (criterion === 'points_average_global') {
    group.forEach((team) => {
      values[team.teamId] = computeAverage(team.pointsFor, team.pointsAgainst);
    });
    return { values, applied: true };
  }

  if (criterion === 'random_draw') {
    group.forEach((team) => {
      values[team.teamId] = deterministicDrawValue(team.seed, team.teamId);
    });
    return { values, applied: true };
  }

  return { values: {}, applied: false };
};

const sortWithTieBreakers = (
  standings: AggregatedStats[],
  matches: TournamentMatch[],
  tieBreakerOrder: TieBreakerCriterion[],
) => {
  const baseSorted = [...standings].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamName.localeCompare(b.teamName);
  });

  const result: AggregatedStats[] = [];
  let index = 0;

  while (index < baseSorted.length) {
    const tieGroup: AggregatedStats[] = [baseSorted[index]];
    let offset = index + 1;

    while (offset < baseSorted.length && baseSorted[offset].matchPoints === baseSorted[index].matchPoints) {
      tieGroup.push(baseSorted[offset]);
      offset += 1;
    }

    if (tieGroup.length === 1) {
      result.push(tieGroup[0]);
      index = offset;
      continue;
    }

    const resolved = resolveTieGroup(tieGroup, matches, tieBreakerOrder, 0);
    result.push(...resolved);
    index = offset;
  }

  return result;
};

const resolveTieGroup = (
  group: AggregatedStats[],
  matches: TournamentMatch[],
  tieBreakerOrder: TieBreakerCriterion[],
  criterionIndex: number,
): AggregatedStats[] => {
  if (group.length <= 1) {
    return group;
  }

  if (criterionIndex >= tieBreakerOrder.length) {
    return [...group].sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  const criterion = tieBreakerOrder[criterionIndex];
  const { values, applied } = computeCriterionValues(criterion, group, matches);

  if (!applied) {
    return resolveTieGroup(group, matches, tieBreakerOrder, criterionIndex + 1);
  }

  let hasDistinctValues = false;

  group.forEach((standing) => {
    if (values[standing.teamId] !== undefined) {
      standing.tieBreakValues[criterion] = values[standing.teamId];
    }
  });

  const sorted = [...group].sort((a, b) => {
    const valueA = values[a.teamId];
    const valueB = values[b.teamId];

    if (valueA === undefined && valueB === undefined) return 0;
    if (valueA === undefined) return 1;
    if (valueB === undefined) return -1;

    if (valueB !== valueA) {
      hasDistinctValues = true;
      return valueB - valueA;
    }

    return 0;
  });

  if (!hasDistinctValues) {
    return resolveTieGroup(group, matches, tieBreakerOrder, criterionIndex + 1);
  }

  const resolved: AggregatedStats[] = [];
  let pointer = 0;

  while (pointer < sorted.length) {
    const subgroup: AggregatedStats[] = [sorted[pointer]];
    let innerPointer = pointer + 1;

    while (innerPointer < sorted.length) {
      const valueCurrent = values[sorted[pointer].teamId];
      const valueCandidate = values[sorted[innerPointer].teamId];
      if (valueCurrent === valueCandidate) {
        subgroup.push(sorted[innerPointer]);
        innerPointer += 1;
      } else {
        break;
      }
    }

    if (subgroup.length > 1) {
      resolved.push(...resolveTieGroup(subgroup, matches, tieBreakerOrder, criterionIndex + 1));
    } else {
      resolved.push(subgroup[0]);
    }

    pointer = innerPointer;
  }

  return resolved;
};

const toTournamentStanding = (standings: AggregatedStats[]): TournamentStanding[] =>
  standings.map((standing) => ({
    teamId: standing.teamId,
    teamName: standing.teamName,
    seed: standing.seed,
    matchesPlayed: standing.matchesPlayed,
    wins: standing.wins,
    losses: standing.losses,
    setsWon: standing.setsWon,
    setsLost: standing.setsLost,
    pointsFor: standing.pointsFor,
    pointsAgainst: standing.pointsAgainst,
    matchPoints: standing.matchPoints,
    tieBreakValues: standing.tieBreakValues,
  }));

export const calculateGroupStandings = ({
  matches,
  teams,
  group,
  tieBreakerOrder,
}: GroupStandingsOptions): TournamentStanding[] => {
  const tieOrder = tieBreakerOrder?.length ? tieBreakerOrder : defaultTieBreakerOrder;
  const groupMatches = matches.filter((match) => match.groupId === group.id);
  const standings = aggregateStatsForScope(groupMatches, teams, group.teamIds);
  const sorted = sortWithTieBreakers(standings, groupMatches, tieOrder);
  return toTournamentStanding(sorted);
};

export const calculatePhaseStandings = ({
  matches,
  teams,
  phaseId,
  tieBreakerOrder,
}: PhaseStandingsOptions): TournamentStanding[] => {
  const tieOrder = tieBreakerOrder?.length ? tieBreakerOrder : defaultTieBreakerOrder;
  const phaseMatches = matches.filter((match) => match.phaseId === phaseId);
  const teamIds = teams.map((team) => team.id);
  const standings = aggregateStatsForScope(phaseMatches, teams, teamIds);
  const sorted = sortWithTieBreakers(standings, phaseMatches, tieOrder);
  return toTournamentStanding(sorted);
};
