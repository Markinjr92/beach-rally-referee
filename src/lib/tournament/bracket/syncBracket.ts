import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { TournamentFormatId, TieBreakerCriterion } from '@/types/volleyball';
import { getMatchConfigFromFormat } from '@/utils/matchConfig';
import { getBracketDefinition } from './definitions';
import { resolveBracketMatches } from './resolveSlots';
import {
  buildCrossGlobalRanking,
  buildGlobalRanking,
  buildGoldSilverRankings,
  buildQualifiers,
  getMatchWinnerId,
  selectBestNthFromGroups,
} from './standings';
import type { BracketContext, BracketSyncResult, MatchRow } from './types';

type TournamentRow = Tables<'tournaments'>;

type MatchWithKey = MatchRow & { match_key?: string | null };

export const buildBracketContext = async (
  tournamentId: string,
  formatId: TournamentFormatId,
  options?: {
    tieBreakerOrder?: TieBreakerCriterion[];
    includeThirdPlace?: boolean;
  },
): Promise<BracketContext | null> => {
  const definition = getBracketDefinition(formatId);
  if (!definition) return null;

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return null;

  const { data: tournamentTeams } = await supabase
    .from('tournament_teams')
    .select('team_id, group_label, seed')
    .eq('tournament_id', tournamentId);

  const teamIds = (tournamentTeams ?? []).map((tt) => tt.team_id);
  const { data: teams } = await supabase.from('teams').select('*').in('id', teamIds);

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId);

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: matchScores } = matchIds.length
    ? await supabase.from('match_scores').select('*').in('match_id', matchIds)
    : { data: [] as Tables<'match_scores'>[] };

  const teamGroups: Record<string, string | null> = {};
  const seedMap = new Map<number, string>();
  (tournamentTeams ?? []).forEach((tt) => {
    teamGroups[tt.team_id] = tt.group_label;
    if (tt.seed != null) seedMap.set(tt.seed, tt.team_id);
  });

  const tieBreakerOrder =
    options?.tieBreakerOrder ??
    (Array.isArray(tournament.tie_breaker_order)
      ? (tournament.tie_breaker_order as TieBreakerCriterion[])
      : []);

  const includeThirdPlace =
    options?.includeThirdPlace ?? tournament.include_third_place ?? false;

  const groups = buildQualifiers({
    teams: teams ?? [],
    teamGroups,
    matches: matches ?? [],
    matchScores: matchScores ?? [],
    crossGroup: definition.crossGroupStandings ?? false,
    tieBreakerOrder,
  });

  const globalRanking = buildGlobalRanking(
    groups,
    definition.globalRankingRequiresAllGroups ?? false,
  );

  const crossGlobalRanking = definition.crossGroupStandings
    ? buildCrossGlobalRanking(groups, matches ?? [], matchScores ?? [], teams ?? [])
    : [];

  const { gold, silver } = buildGoldSilverRankings(groups);
  const bestSeconds = selectBestNthFromGroups(groups, 'second', 5, true);
  const bestThirds = selectBestNthFromGroups(groups, 'third', 3, true);

  const matchByKey = new Map<string, MatchRow>();
  const matchWinners = new Map<string, string>();
  const matchLosers = new Map<string, string>();

  (matches ?? []).forEach((match) => {
    const key = (match as MatchWithKey).match_key;
    if (!key) return;
    matchByKey.set(key, match);
    const winner = getMatchWinnerId(match, matchScores ?? []);
    if (winner) {
      matchWinners.set(key, winner);
      const loser = winner === match.team_a_id ? match.team_b_id : match.team_a_id;
      if (loser) matchLosers.set(key, loser);
    }
  });

  return {
    formatId,
    definition,
    tieBreakerOrder,
    includeThirdPlace,
    groups,
    globalRanking,
    crossGlobalRanking,
    goldRanking: gold,
    silverRanking: silver,
    bestSeconds,
    bestThirds,
    matchByKey,
    matchWinners,
    matchLosers,
    groupLabels: groups.map((g) => g.groupKey),
    seedMap,
  };
};

const getMatchConfig = (tournament: TournamentRow, configType: string) => {
  const keyMap: Record<string, keyof TournamentRow> = {
    groups: 'match_format_groups',
    quarterfinals: 'match_format_quarterfinals',
    semifinals: 'match_format_semifinals',
    final: 'match_format_final',
    thirdPlace: 'match_format_third_place',
  };
  const field = keyMap[configType] ?? 'match_format_quarterfinals';
  const formatValue = tournament[field] as string | null;
  return getMatchConfigFromFormat(formatValue ?? undefined);
};

const teamsMatch = (a: string, b: string, teamA: string, teamB: string) =>
  (a === teamA && b === teamB) || (a === teamB && b === teamA);

const findExistingMatch = (
  matches: MatchRow[],
  item: { key: string; phase: string; teamAId: string; teamBId: string },
  matchByKey: Map<string, MatchRow>,
): MatchRow | undefined => {
  const byKey = matchByKey.get(item.key);
  if (byKey) return byKey;

  return matches.find((m) => {
    if (!m.team_a_id || !m.team_b_id) return false;
    if (m.phase !== item.phase) return false;
    return teamsMatch(m.team_a_id, m.team_b_id, item.teamAId, item.teamBId);
  });
};

export const syncTournamentBracket = async (
  tournamentId: string,
): Promise<BracketSyncResult> => {
  const result: BracketSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    resolved: [],
  };

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournament?.format_id) return result;

  const formatId = tournament.format_id as TournamentFormatId;
  const ctx = await buildBracketContext(tournamentId, formatId);
  if (!ctx) return result;

  const { data: allMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId);

  const resolved = resolveBracketMatches(ctx);
  result.resolved = resolved;

  for (const item of resolved) {
    const existing = findExistingMatch(allMatches ?? [], item, ctx.matchByKey);

    if (existing) {
      const needsTeamUpdate =
        existing.team_a_id !== item.teamAId || existing.team_b_id !== item.teamBId;
      const needsKey = !(existing as MatchWithKey).match_key;

      if (
        (needsTeamUpdate || needsKey) &&
        existing.status !== 'completed' &&
        existing.status !== 'in_progress'
      ) {
        const { error } = await supabase
          .from('matches')
          .update({
            team_a_id: item.teamAId,
            team_b_id: item.teamBId,
            phase: item.phase,
            match_key: item.key,
          })
          .eq('id', existing.id);

        if (!error) result.updated += 1;
        else result.skipped += 1;
      } else {
        result.skipped += 1;
      }
      continue;
    }

    const config = getMatchConfig(tournament, item.configType);
    const payload: TablesInsert<'matches'> & { match_key: string } = {
      tournament_id: tournamentId,
      team_a_id: item.teamAId,
      team_b_id: item.teamBId,
      phase: item.phase,
      status: 'scheduled',
      match_key: item.key,
      points_per_set: config.pointsPerSet,
      side_switch_sum: config.sideSwitchSum,
      best_of: config.bestOf,
      modality: tournament.modality ?? 'dupla',
      direct_win_format: false,
    };

    const { error } = await supabase.from('matches').insert(payload);
    if (!error) result.created += 1;
    else result.skipped += 1;
  }

  return result;
};
