import { TournamentFormatId, TournamentTeam } from '@/types/volleyball';
import { generateTournamentStructure } from '@/lib/tournament/formats';
import { getBracketDefinition } from './definitions';
import {
  buildCrossGlobalRanking,
  buildGlobalRanking,
  buildGoldSilverRankings,
  buildQualifiers,
  selectBestNthFromGroups,
} from './standings';
import { resolveBracketMatches } from './resolveSlots';
import type {
  BracketContext,
  BracketMatchDef,
  MatchRow,
  MatchScoreRow,
  ResolvedMatch,
  SlotRef,
  TeamRow,
} from './types';
import { findGroup } from './standings';

/** Quantidade de equipes exigida por formato (espelha formats.ts) */
export const FORMAT_TEAM_COUNT: Record<TournamentFormatId, number> = {
  groups_and_knockout: 12,
  '4_groups_3_3_4_4_quarterfinals': 14,
  '3_groups_quarterfinals': 12,
  '2_groups_5_quarterfinals': 10,
  '2_groups_4_quarterfinals': 8,
  '2_groups_6_cross_semis': 12,
  '2_groups_3_cross_semis': 6,
  global_semis: 12,
  series_gold_silver: 12,
  single_elimination: 12,
  double_elimination: 12,
  '6_teams_round_robin': 6,
  '5_teams_round_robin': 5,
  '4_teams_round_robin': 4,
  '3_groups_3_semis': 9,
  '3_groups_3_quarterfinals': 9,
  '5_groups_3_quarterfinals': 15,
  '3_groups_4_repechage_quarterfinals': 12,
  '2_groups_cross_full_repechage_semis': 8,
  '2_groups_double_bracket_final': 8,
  '2_groups_3_repescagem_semis': 6,
  '2_groups_4_semis': 8,
  '2_groups_5_4_semis': 9,
  '2_groups_5_semis': 10,
};

const buildTeams = (count: number): TournamentTeam[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `team-seed-${i + 1}`,
    seed: i + 1,
    team: {
      name: `Equipe ${i + 1}`,
      players: [
        { name: `J${i + 1}A`, number: 1 },
        { name: `J${i + 1}B`, number: 2 },
      ],
    },
  }));

const toTeamRows = (teams: TournamentTeam[]): TeamRow[] =>
  teams.map((t) => ({
    id: t.id,
    name: t.team.name,
    player_a: t.team.players[0]?.name ?? 'A',
    player_b: t.team.players[1]?.name ?? 'B',
    player_c: null,
    player_d: null,
    created_at: null,
  }));

const seedOf = (teamId: string, seedMap: Map<string, number>) =>
  seedMap.get(teamId) ?? 999;

/** Vencedor = menor seed (equipe mais forte no cenário de teste) */
export const pickWinner = (
  teamAId: string,
  teamBId: string,
  seedMap: Map<string, number>,
): string => {
  const sa = seedOf(teamAId, seedMap);
  const sb = seedOf(teamBId, seedMap);
  return sa <= sb ? teamAId : teamBId;
};

const KEY_FROM_TITLE: Record<string, string> = {
  'Grupo A - J1': 'GA-J1',
  'Grupo A - J2': 'GA-J2',
  'Grupo B - J1': 'GB-J1',
  'Grupo B - J2': 'GB-J2',
};

const structureToDbMatches = (
  tournamentId: string,
  formatId: TournamentFormatId,
  structure: ReturnType<typeof generateTournamentStructure>,
  seedMap: Map<string, number>,
): { matches: MatchRow[]; scores: MatchScoreRow[] } => {
  const matches: MatchRow[] = [];
  const scores: MatchScoreRow[] = [];
  let idx = 0;
  let r1Counter = 0;
  let wr1Counter = 0;

  const playable = structure.matches.filter((m) => m.teamAId && m.teamBId);

  playable.forEach((m) => {
    let matchKey: string | null = KEY_FROM_TITLE[m.title] ?? null;

    if (!matchKey && formatId === 'single_elimination') {
      r1Counter += 1;
      matchKey = `R1-${r1Counter}`;
    }
    if (!matchKey && formatId === 'double_elimination' && m.title.includes('Winners R1')) {
      wr1Counter += 1;
      matchKey = `WR1-${wr1Counter}`;
    }

    const id = `match-${idx++}`;
    const winner = pickWinner(m.teamAId!, m.teamBId!, seedMap);
    const teamAWins = winner === m.teamAId;

    matches.push({
      id,
      tournament_id: tournamentId,
      team_a_id: m.teamAId!,
      team_b_id: m.teamBId!,
      phase: m.phaseName ?? 'Fase de Grupos',
      status: 'completed',
      best_of: 1,
      points_per_set: [21],
      side_switch_sum: [7],
      modality: 'dupla',
      direct_win_format: false,
      court: null,
      created_at: null,
      referee_id: null,
      match_key: matchKey,
    });

    if (matchKey) {
      // pré-registrar vencedor para slots winner/loser
    }

    scores.push({
      id: `score-${id}`,
      match_id: id,
      set_number: 1,
      team_a_points: teamAWins ? 21 : 15,
      team_b_points: teamAWins ? 15 : 21,
      created_at: null,
    });
  });

  return { matches, scores };
};

export const buildBracketContextFromSimulation = (
  formatId: TournamentFormatId,
  matches: MatchRow[],
  matchScores: MatchScoreRow[],
  teams: TeamRow[],
  teamGroups: Record<string, string | null>,
  seedMap: Map<string, number>,
  matchWinners: Map<string, string>,
  matchLosers: Map<string, string>,
  includeThirdPlace = true,
): BracketContext | null => {
  const definition = getBracketDefinition(formatId);
  if (!definition) return null;

  const groups = buildQualifiers({
    teams,
    teamGroups,
    matches,
    matchScores,
    crossGroup: definition.crossGroupStandings ?? false,
    tieBreakerOrder: [],
  });

  const globalRanking = buildGlobalRanking(
    groups,
    definition.globalRankingRequiresAllGroups ?? false,
  );

  const crossGlobalRanking = definition.crossGroupStandings
    ? buildCrossGlobalRanking(groups, matches, matchScores, teams)
    : [];

  const { gold, silver } = buildGoldSilverRankings(groups);
  const bestSeconds = selectBestNthFromGroups(groups, 'second', 5, true);
  const bestThirds = selectBestNthFromGroups(groups, 'third', 3, true);

  const matchByKey = new Map<string, MatchRow>();
  matches.forEach((m) => {
    if (m.match_key) matchByKey.set(m.match_key, m);
  });

  const seedByNumber = new Map<number, string>();
  seedMap.forEach((seed, teamId) => seedByNumber.set(seed, teamId));

  return {
    formatId,
    definition,
    tieBreakerOrder: [],
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
    seedMap: seedByNumber,
  };
};

const resolveSlotId = (ctx: BracketContext, slot: SlotRef): string | null => {
  switch (slot.type) {
    case 'groupRank': {
      const group = findGroup(ctx.groups, slot.group);
      if (!group?.isComplete) return null;
      return group.standings[slot.rank - 1]?.teamId ?? null;
    }
    case 'globalRank': {
      const pool = slot.pool ?? 'all';
      const ranking =
        pool === 'cross'
          ? ctx.crossGlobalRanking
          : pool === 'gold'
            ? ctx.goldRanking
            : pool === 'silver'
              ? ctx.silverRanking
              : ctx.globalRanking;
      return ranking[slot.rank - 1]?.teamId ?? null;
    }
    case 'bestGroupRank': {
      const list = slot.position === 'second' ? ctx.bestSeconds : ctx.bestThirds;
      return list[slot.index]?.teamId ?? null;
    }
    case 'winner':
      return ctx.matchWinners.get(slot.matchKey) ?? null;
    case 'loser':
      return ctx.matchLosers.get(slot.matchKey) ?? null;
    case 'seed':
      return ctx.seedMap.get(slot.seed) ?? null;
    default:
      return null;
  }
};

export const validateMatchAgainstDefinition = (
  ctx: BracketContext,
  def: BracketMatchDef,
  resolved: ResolvedMatch,
): string[] => {
  const errors: string[] = [];
  const expectedA = resolveSlotId(ctx, def.teamA);
  const expectedB = resolveSlotId(ctx, def.teamB);

  if (expectedA && expectedA !== resolved.teamAId) {
    errors.push(`${def.key} teamA: esperado ${expectedA}, obteve ${resolved.teamAId}`);
  }
  if (expectedB && expectedB !== resolved.teamBId) {
    errors.push(`${def.key} teamB: esperado ${expectedB}, obteve ${resolved.teamBId}`);
  }
  return errors;
};

/** Simula fase de grupos + mata-mata completo e valida classificação/cruzamentos */
export const simulateAndValidateFormat = (
  formatId: TournamentFormatId,
): { ok: boolean; errors: string[]; resolvedCount: number; expectedCount: number } => {
  const errors: string[] = [];
  const definition = getBracketDefinition(formatId);
  if (!definition) {
    return { ok: false, errors: [`Definição não encontrada: ${formatId}`], resolvedCount: 0, expectedCount: 0 };
  }

  const teamCount = FORMAT_TEAM_COUNT[formatId];
  const tournamentTeams = buildTeams(teamCount);
  const seedMap = new Map(tournamentTeams.map((t) => [t.id, t.seed]));

  let structure;
  try {
    structure = generateTournamentStructure({
      tournamentId: 'test-tournament',
      formatId,
      teams: tournamentTeams,
      includeThirdPlaceMatch: true,
    });
  } catch (e) {
    return {
      ok: false,
      errors: [`Falha ao gerar estrutura: ${e instanceof Error ? e.message : String(e)}`],
      resolvedCount: 0,
      expectedCount: 0,
    };
  }

  const teamGroups: Record<string, string | null> = {};
  structure.groups.forEach((g) => {
    g.teamIds.forEach((tid) => {
      teamGroups[tid] = g.name;
    });
  });

  const teams = toTeamRows(tournamentTeams);

  const { matches: groupMatches, scores: groupScores } = structureToDbMatches(
    'test-tournament',
    formatId,
    structure,
    seedMap,
  );
  const allMatches = [...groupMatches];
  const allScores = [...groupScores];
  const matchWinners = new Map<string, string>();
  const matchLosers = new Map<string, string>();

  // Registrar vencedores dos jogos iniciais com match_key (R1, GA-J1, etc.)
  allMatches.forEach((m) => {
    if (!m.match_key || !m.team_a_id || !m.team_b_id) return;
    const winner = pickWinner(m.team_a_id, m.team_b_id, seedMap);
    matchWinners.set(m.match_key, winner);
    matchLosers.set(m.match_key, winner === m.team_a_id ? m.team_b_id : m.team_a_id);
  });

  const seedOnlyFormats: TournamentFormatId[] = ['single_elimination', 'double_elimination'];
  const skipGroupValidation = seedOnlyFormats.includes(formatId);

  if (!skipGroupValidation && structure.groups.length > 0) {
    const ctxAfterGroups = buildBracketContextFromSimulation(
      formatId,
      allMatches,
      allScores,
      teams,
      teamGroups,
      seedMap,
      matchWinners,
      matchLosers,
    );
    if (ctxAfterGroups) {
      for (const group of ctxAfterGroups.groups) {
        if (!group.isComplete) {
          errors.push(`Grupo ${group.groupKey} não marcado como completo após simular todos os jogos`);
        }
        if (group.standings.length < 2) {
          errors.push(`Grupo ${group.groupKey} sem classificação suficiente`);
        }
      }
    }
  }

  let iterations = 0;
  const maxIterations = 30;

  while (iterations < maxIterations) {
    iterations += 1;
    const ctx = buildBracketContextFromSimulation(
      formatId,
      allMatches,
      allScores,
      teams,
      teamGroups,
      seedMap,
      matchWinners,
      matchLosers,
    );
    if (!ctx) break;

    const resolved = resolveBracketMatches(ctx);
    const newMatches = resolved.filter((r) => !matchWinners.has(r.key) && !allMatches.some((m) => m.match_key === r.key));

    if (newMatches.length === 0) break;

    for (const r of newMatches) {
      const def = definition.matches.find((d) => d.key === r.key);
      if (def) {
        errors.push(...validateMatchAgainstDefinition(ctx, def, r));
      }

      const winner = pickWinner(r.teamAId, r.teamBId, seedMap);
      const loser = winner === r.teamAId ? r.teamBId : r.teamAId;
      matchWinners.set(r.key, winner);
      matchLosers.set(r.key, loser);

      const id = `ko-${r.key}`;
      allMatches.push({
        id,
        tournament_id: 'test-tournament',
        team_a_id: r.teamAId,
        team_b_id: r.teamBId,
        phase: r.phase,
        status: 'completed',
        best_of: 1,
        points_per_set: [21],
        side_switch_sum: [7],
        modality: 'dupla',
        direct_win_format: false,
        court: null,
        created_at: null,
        referee_id: null,
        match_key: r.key,
      });
      allScores.push({
        id: `score-${id}`,
        match_id: id,
        set_number: 1,
        team_a_points: winner === r.teamAId ? 21 : 15,
        team_b_points: winner === r.teamAId ? 15 : 21,
        created_at: null,
      });
    }
  }

  const finalCtx = buildBracketContextFromSimulation(
    formatId,
    allMatches,
    allScores,
    teams,
    teamGroups,
    seedMap,
    matchWinners,
    matchLosers,
  );

  if (!finalCtx) {
    return { ok: false, errors: ['Contexto final inválido'], resolvedCount: 0, expectedCount: 0 };
  }

  const finalResolved = resolveBracketMatches(finalCtx);
  const expectedMatches = definition.matches.filter((d) => !d.requiresThirdPlace || true);

  for (const def of expectedMatches) {
    const found = finalResolved.find((r) => r.key === def.key);
    if (!found) {
      errors.push(`Confronto não gerado: ${def.key} (${def.label})`);
    }
  }

  const hasDuplicateTeams = (round: ResolvedMatch[]) => {
    const used = new Set<string>();
    for (const m of round) {
      if (used.has(m.teamAId) || used.has(m.teamBId)) return true;
      used.add(m.teamAId);
      used.add(m.teamBId);
    }
    return false;
  };

  /** Agrupa por fase + rodada da chave (ex.: WR3-1 e WF ficam em baldes distintos) */
  const bracketRoundBucket = (key: string) => key.replace(/-\d+$/, '') || key;

  const byPhaseRound = new Map<string, ResolvedMatch[]>();
  finalResolved.forEach((r) => {
    const bucket = `${r.phase}::${bracketRoundBucket(r.key)}`;
    const list = byPhaseRound.get(bucket) ?? [];
    list.push(r);
    byPhaseRound.set(bucket, list);
  });
  byPhaseRound.forEach((round, bucket) => {
    if (hasDuplicateTeams(round)) {
      const [phase] = bucket.split('::');
      errors.push(`Fase ${phase}: equipe repetida em confrontos da mesma rodada`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    resolvedCount: finalResolved.length,
    expectedCount: expectedMatches.length,
  };
};
