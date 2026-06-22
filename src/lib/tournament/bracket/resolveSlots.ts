import type { BracketContext, ResolvedMatch, SlotRef, BracketMatchDef } from './types';
import { findGroup } from './standings';

const resolveSlot = (ctx: BracketContext, slot: SlotRef): string | null => {
  switch (slot.type) {
    case 'seed':
      return ctx.seedMap.get(slot.seed) ?? null;

    case 'groupRank': {
      const group = findGroup(ctx.groups, slot.group);
      if (!group || !group.isComplete) return null;
      const standing = group.standings[slot.rank - 1];
      return standing?.teamId ?? null;
    }

    case 'globalRank': {
      const pool = slot.pool ?? 'all';
      let ranking = ctx.globalRanking;
      if (pool === 'cross') ranking = ctx.crossGlobalRanking;
      if (pool === 'gold') ranking = ctx.goldRanking;
      if (pool === 'silver') ranking = ctx.silverRanking;
      if (!ranking.length) return null;
      return ranking[slot.rank - 1]?.teamId ?? null;
    }

    case 'bestGroupRank': {
      const list =
        slot.position === 'second' ? ctx.bestSeconds : ctx.bestThirds;
      if (!list.length) return null;
      return list[slot.index]?.teamId ?? null;
    }

    case 'winner':
      return ctx.matchWinners.get(slot.matchKey) ?? null;

    case 'loser':
      return ctx.matchLosers.get(slot.matchKey) ?? null;

    default:
      return null;
  }
};

export const getSlotDependencies = (
  slot: SlotRef,
): { groups: string[]; matchKeys: string[] } => {
  switch (slot.type) {
    case 'groupRank':
      return { groups: [slot.group], matchKeys: [] };
    case 'globalRank':
      return { groups: [], matchKeys: [] };
    case 'bestGroupRank':
      return { groups: [], matchKeys: [] };
    case 'winner':
    case 'loser':
      return { groups: [], matchKeys: [slot.matchKey] };
    case 'seed':
      return { groups: [], matchKeys: [] };
    default:
      return { groups: [], matchKeys: [] };
  }
};

export const getMatchDependencies = (def: BracketMatchDef) => {
  const groups = new Set<string>();
  const matchKeys = new Set<string>();
  [def.teamA, def.teamB].forEach((slot) => {
    const deps = getSlotDependencies(slot);
    deps.groups.forEach((g) => groups.add(g));
    deps.matchKeys.forEach((k) => matchKeys.add(k));
  });
  return { groups: [...groups], matchKeys: [...matchKeys] };
};

export const resolveBracketMatches = (
  ctx: BracketContext,
): ResolvedMatch[] => {
  const resolved: ResolvedMatch[] = [];

  for (const def of ctx.definition.matches) {
    if (def.requiresThirdPlace && !ctx.includeThirdPlace) continue;

    const teamAId = resolveSlot(ctx, def.teamA);
    const teamBId = resolveSlot(ctx, def.teamB);

    if (!teamAId || !teamBId || teamAId === teamBId) continue;

    resolved.push({
      key: def.key,
      phase: def.phase,
      teamAId,
      teamBId,
      configType: def.configType ?? 'quarterfinals',
    });
  }

  return resolved;
};
