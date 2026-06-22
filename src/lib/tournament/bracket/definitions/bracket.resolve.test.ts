import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TournamentFormatId } from '@/types/volleyball';
import { allBracketDefinitions, getBracketDefinition } from './index';
import { resolveBracketMatches } from '../resolveSlots';
import type { BracketContext, GroupQualifiers } from '../types';

const makeStanding = (teamId: string, rank: number, name?: string) => ({
  teamId,
  teamName: name ?? teamId,
  matchesPlayed: 4,
  wins: 5 - rank,
  losses: rank - 1,
  setsWon: 8 - rank,
  setsLost: rank,
  pointsFor: 100 - rank * 10,
  pointsAgainst: 50 + rank * 5,
  matchPoints: 6 - rank,
});

const makeGroup = (
  key: string,
  teamIds: string[],
  complete: boolean,
): GroupQualifiers => ({
  groupKey: key,
  first: teamIds[0],
  second: teamIds[1],
  third: teamIds[2],
  fourth: teamIds[3],
  standings: teamIds.map((id, i) => makeStanding(id, i + 1, `${key}-${i + 1}`)),
  isComplete: complete,
});

const baseCtx = (
  formatId: TournamentFormatId,
  overrides: Partial<BracketContext>,
): BracketContext => {
  const definition = getBracketDefinition(formatId)!;
  return {
    formatId,
    definition,
    tieBreakerOrder: [],
    includeThirdPlace: true,
    groups: [],
    globalRanking: [],
    crossGlobalRanking: [],
    goldRanking: [],
    silverRanking: [],
    bestSeconds: [],
    bestThirds: [],
    matchByKey: new Map(),
    matchWinners: new Map(),
    matchLosers: new Map(),
    groupLabels: [],
    seedMap: new Map(),
    ...overrides,
  };
};

describe('motor de bracket — definições', () => {
  it('cobre todos os 24 formatos do sistema', () => {
    assert.equal(allBracketDefinitions.length, 24);
  });

  it('2_groups_5_semis gera semis cruzadas quando grupos completos', () => {
    const ctx = baseCtx('2_groups_5_semis', {
      groups: [
        makeGroup('Grupo A', ['a1', 'a2', 'a3', 'a4', 'a5'], true),
        makeGroup('Grupo B', ['b1', 'b2', 'b3', 'b4', 'b5'], true),
      ],
    });

    const resolved = resolveBracketMatches(ctx);
    const sf1 = resolved.find((m) => m.key === 'SF1');
    const sf2 = resolved.find((m) => m.key === 'SF2');

    assert.ok(sf1);
    assert.ok(sf2);
    assert.equal(sf1!.teamAId, 'a1');
    assert.equal(sf1!.teamBId, 'b2');
    assert.equal(sf2!.teamAId, 'b1');
    assert.equal(sf2!.teamBId, 'a2');
  });

  it('groups_and_knockout antecipa QF1 quando grupos A e D terminam', () => {
    const ctx = baseCtx('groups_and_knockout', {
      groups: [
        makeGroup('Grupo A', ['a1', 'a2', 'a3'], true),
        makeGroup('Grupo B', ['b1', 'b2', 'b3'], false),
        makeGroup('Grupo C', ['c1', 'c2', 'c3'], false),
        makeGroup('Grupo D', ['d1', 'd2', 'd3'], true),
      ],
    });

    const resolved = resolveBracketMatches(ctx);
    const qf1 = resolved.find((m) => m.key === 'QF1');
    const qf2 = resolved.find((m) => m.key === 'QF2');

    assert.ok(qf1);
    assert.equal(qf1!.teamAId, 'a1');
    assert.equal(qf1!.teamBId, 'd2');
    assert.equal(qf2, undefined);
  });

  it('2_groups_5_quarterfinals usa pareamento 1A×4B (não 4 grupos)', () => {
    const ctx = baseCtx('2_groups_5_quarterfinals', {
      groups: [
        makeGroup('Grupo A', ['a1', 'a2', 'a3', 'a4', 'a5'], true),
        makeGroup('Grupo B', ['b1', 'b2', 'b3', 'b4', 'b5'], true),
      ],
    });

    const resolved = resolveBracketMatches(ctx);
    const qf1 = resolved.find((m) => m.key === 'QF1');
    assert.equal(qf1?.teamAId, 'a1');
    assert.equal(qf1?.teamBId, 'b4');
  });

  it('repescagem 2_groups_3 avança para semis após repescagens', () => {
    const ctx = baseCtx('2_groups_3_repescagem_semis', {
      groups: [
        makeGroup('Grupo A', ['a1', 'a2', 'a3'], true),
        makeGroup('Grupo B', ['b1', 'b2', 'b3'], true),
      ],
      matchWinners: new Map([
        ['REP1', 'rep1-winner'],
        ['REP2', 'rep2-winner'],
      ]),
    });

    const resolved = resolveBracketMatches(ctx);
    const sf1 = resolved.find((m) => m.key === 'SF1');
    assert.equal(sf1?.teamAId, 'a1');
    assert.equal(sf1?.teamBId, 'rep2-winner');
  });
});
