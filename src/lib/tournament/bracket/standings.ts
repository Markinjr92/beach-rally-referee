import { TieBreakerCriterion } from '@/types/volleyball';
import { isMatchCompleted } from '@/utils/matchStatus';
import {
  buildGroupAssignments,
  computeStandingsByGroup,
} from '@/utils/tournamentStandings';
import type {
  GroupQualifiers,
  GroupStandingEntry,
  MatchRow,
  MatchScoreRow,
  TeamRow,
} from './types';

const compareDesc = (a: number, b: number) => b - a;

const compareStandings = (a: GroupStandingEntry, b: GroupStandingEntry) => {
  if (a.matchPoints !== b.matchPoints) return compareDesc(a.matchPoints, b.matchPoints);
  if (a.wins !== b.wins) return compareDesc(a.wins, b.wins);
  const setDiffA = a.setsWon - a.setsLost;
  const setDiffB = b.setsWon - b.setsLost;
  if (setDiffB !== setDiffA) return compareDesc(setDiffB, setDiffA);
  const ptDiffA = a.pointsFor - a.pointsAgainst;
  const ptDiffB = b.pointsFor - b.pointsAgainst;
  if (ptDiffB !== ptDiffA) return compareDesc(ptDiffB, ptDiffA);
  return a.teamName.localeCompare(b.teamName, 'pt-BR');
};

const isGroupMatchForTeam = (
  match: MatchRow,
  teamId: string,
  groupTeamIds: Set<string>,
) => {
  const a = match.team_a_id;
  const b = match.team_b_id;
  if (!a || !b) return false;
  return (a === teamId || b === teamId) && groupTeamIds.has(a) && groupTeamIds.has(b);
};

const isGroupPhaseMatch = (match: MatchRow) =>
  (match.phase ?? '').toLowerCase().includes('grupo') ||
  match.phase === 'Fase de Grupos';

export const isGroupComplete = (
  groupKey: string,
  groupTeamIds: string[],
  matches: MatchRow[],
  crossGroup: boolean,
): boolean => {
  const teamSet = new Set(groupTeamIds);
  const groupMatches = matches.filter((m) => {
    if (!isGroupPhaseMatch(m)) return false;
    const a = m.team_a_id;
    const b = m.team_b_id;
    if (!a || !b) return false;
    if (crossGroup) {
      return teamSet.has(a) || teamSet.has(b);
    }
    return teamSet.has(a) && teamSet.has(b);
  });

  if (!groupMatches.length) return false;
  return groupMatches.every((m) => isMatchCompleted(m.status));
};

export const buildQualifiers = ({
  teams,
  teamGroups,
  matches,
  matchScores,
  crossGroup,
  tieBreakerOrder: _tie,
}: {
  teams: TeamRow[];
  teamGroups: Record<string, string | null>;
  matches: MatchRow[];
  matchScores: MatchScoreRow[];
  crossGroup: boolean;
  tieBreakerOrder: TieBreakerCriterion[];
}): GroupQualifiers[] => {
  const groupAssignments = buildGroupAssignments(teams, teamGroups);
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  const scoresByMatch = new Map<string, MatchScoreRow[]>();
  matchScores.forEach((score) => {
    const list = scoresByMatch.get(score.match_id) ?? [];
    list.push(score);
    scoresByMatch.set(score.match_id, list);
  });
  scoresByMatch.forEach((scores) => scores.sort((a, b) => a.set_number - b.set_number));

  const standingsByGroup = computeStandingsByGroup({
    matches,
    scoresByMatch,
    groupAssignments,
    teamNameMap,
    isCrossGroupFormat: crossGroup,
  });

  return standingsByGroup.map((group) => {
    const assignment = groupAssignments.find((a) => a.key === group.key);
    const teamIds = assignment?.teamIds ?? group.standings.map((s) => s.teamId);

    const standings: GroupStandingEntry[] = group.standings.map((s) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      matchesPlayed: s.matchesPlayed,
      wins: s.wins,
      losses: s.losses,
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      matchPoints: s.matchPoints,
    }));

    const complete = isGroupComplete(group.key, teamIds, matches, crossGroup);

    return {
      groupKey: group.key,
      first: standings[0]?.teamId ?? '',
      second: standings[1]?.teamId ?? '',
      third: standings[2]?.teamId,
      fourth: standings[3]?.teamId,
      standings,
      isComplete: complete,
    };
  });
};

export const buildGlobalRanking = (
  qualifiers: GroupQualifiers[],
  requireAllComplete: boolean,
): GroupStandingEntry[] => {
  if (requireAllComplete && qualifiers.some((g) => !g.isComplete)) {
    return [];
  }

  const all: GroupStandingEntry[] = [];
  qualifiers.forEach((g) => {
    g.standings.forEach((s) => {
      if (!all.some((e) => e.teamId === s.teamId)) {
        all.push(s);
      }
    });
  });

  return [...all].sort(compareStandings);
};

export const buildCrossGlobalRanking = (
  qualifiers: GroupQualifiers[],
  matches: MatchRow[],
  matchScores: MatchScoreRow[],
  teams: TeamRow[],
): GroupStandingEntry[] => {
  if (qualifiers.some((g) => !g.isComplete)) return [];

  const teamGroups: Record<string, string | null> = {};
  qualifiers.forEach((g) => {
    g.standings.forEach((s) => {
      teamGroups[s.teamId] = g.groupKey;
    });
  });

  const crossQualifiers = buildQualifiers({
    teams,
    teamGroups,
    matches,
    matchScores,
    crossGroup: true,
    tieBreakerOrder: [],
  });

  const merged: GroupStandingEntry[] = [];
  crossQualifiers.forEach((g) => {
    g.standings.forEach((s) => {
      if (!merged.some((e) => e.teamId === s.teamId)) merged.push(s);
    });
  });

  return merged.sort(compareStandings);
};

export const selectBestNthFromGroups = (
  qualifiers: GroupQualifiers[],
  position: 'second' | 'third',
  count: number,
  requireAllGroupsComplete = true,
): GroupStandingEntry[] => {
  if (requireAllGroupsComplete && qualifiers.some((g) => !g.isComplete)) {
    return [];
  }

  const candidates: GroupStandingEntry[] = [];
  qualifiers.forEach((g) => {
    const teamId = position === 'second' ? g.second : g.third;
    if (!teamId) return;
    const standing = g.standings.find((s) => s.teamId === teamId);
    if (standing) candidates.push(standing);
  });

  return candidates.sort(compareStandings).slice(0, count);
};

/** Série ouro: 2 melhores de cada grupo; prata: demais */
export const buildGoldSilverRankings = (
  qualifiers: GroupQualifiers[],
): { gold: GroupStandingEntry[]; silver: GroupStandingEntry[] } => {
  if (qualifiers.some((g) => !g.isComplete)) {
    return { gold: [], silver: [] };
  }

  const gold: GroupStandingEntry[] = [];
  const silver: GroupStandingEntry[] = [];

  qualifiers.forEach((g) => {
    if (g.standings[0]) gold.push(g.standings[0]);
    if (g.standings[1]) gold.push(g.standings[1]);
    g.standings.slice(2).forEach((s) => silver.push(s));
  });

  return {
    gold: gold.sort(compareStandings),
    silver: silver.sort(compareStandings),
  };
};

export const getMatchWinnerId = (
  match: MatchRow,
  scores: MatchScoreRow[],
): string | null => {
  if (!isMatchCompleted(match.status)) return null;
  const matchScores = scores.filter((s) => s.match_id === match.id);
  if (!matchScores.length) return null;

  let setsA = 0;
  let setsB = 0;
  matchScores.forEach((s) => {
    if (s.team_a_points > s.team_b_points) setsA += 1;
    else if (s.team_b_points > s.team_a_points) setsB += 1;
  });

  if (setsA > setsB) return match.team_a_id;
  if (setsB > setsA) return match.team_b_id;
  return null;
};

export const normalizeGroupKey = (label: string) => {
  const trimmed = label.trim();
  if (/^grupo\s/i.test(trimmed)) return trimmed;
  if (/^[A-E]$/i.test(trimmed)) return `Grupo ${trimmed.toUpperCase()}`;
  return trimmed;
};

export const findGroup = (qualifiers: GroupQualifiers[], groupRef: string) => {
  const normalized = normalizeGroupKey(groupRef);
  return (
    qualifiers.find(
      (g) =>
        g.groupKey === normalized ||
        g.groupKey.toLowerCase() === normalized.toLowerCase() ||
        g.groupKey.endsWith(` ${groupRef}`) ||
        g.groupKey === groupRef,
    ) ?? null
  );
};
