import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTournamentStructure } from './formats';
import { getFormatsByTeamCount } from './formatFilter';
import { TournamentFormatId, TournamentTeam } from '@/types/volleyball';

const buildTeams = (count: number): TournamentTeam[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    seed: index + 1,
    team: {
      name: `Equipe ${index + 1}`,
      players: [
        { name: `Jogador ${index + 1}A`, number: 1 },
        { name: `Jogador ${index + 1}B`, number: 2 },
      ],
    },
  }));

describe('novos formatos de torneio', () => {
  it('gera grupos e bracket do formato 3_groups_4_repechage_quarterfinals', () => {
    const structure = generateTournamentStructure({
      tournamentId: 't-1',
      formatId: '3_groups_4_repechage_quarterfinals',
      teams: buildTeams(12),
      includeThirdPlaceMatch: true,
    });

    assert.equal(structure.groups.length, 3);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Fase de Grupos').length, 18);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Repescagem').length, 4);
    assert.equal(structure.matches.some((match) => match.title === 'Final'), true);
  });

  it('gera cruzamento completo e repescagem do formato 2_groups_cross_full_repechage_semis', () => {
    const structure = generateTournamentStructure({
      tournamentId: 't-2',
      formatId: '2_groups_cross_full_repechage_semis',
      teams: buildTeams(8),
    });

    assert.equal(structure.groups.length, 2);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Fase de Grupos').length, 16);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Repescagem').length, 2);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Semifinal').length, 3);
  });

  it('gera chave interna e final do formato 2_groups_double_bracket_final', () => {
    const structure = generateTournamentStructure({
      tournamentId: 't-3',
      formatId: '2_groups_double_bracket_final',
      teams: buildTeams(8),
      includeThirdPlaceMatch: true,
    });

    assert.equal(structure.groups.length, 2);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Fase de Grupos').length, 8);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Semifinal').length, 4);
    assert.equal(structure.matches.some((match) => match.title === 'Decisão 3º lugar'), true);
  });

  it('valida quantidade de equipes para os novos formatos', () => {
    const invalidFormats: Array<{ formatId: TournamentFormatId; teams: number }> = [
      { formatId: '4_groups_3_3_4_4_quarterfinals', teams: 13 },
      { formatId: '3_groups_4_repechage_quarterfinals', teams: 11 },
      { formatId: '2_groups_cross_full_repechage_semis', teams: 7 },
      { formatId: '2_groups_double_bracket_final', teams: 7 },
    ];

    invalidFormats.forEach(({ formatId, teams }) => {
      assert.throws(() =>
        generateTournamentStructure({
          tournamentId: 't-invalid',
          formatId,
          teams: buildTeams(teams),
        }),
      );
    });
  });

  it('exibe novos formatos no seletor por quantidade de equipes', () => {
    assert.deepEqual(
      getFormatsByTeamCount(12).includes('3_groups_4_repechage_quarterfinals'),
      true,
    );
    assert.deepEqual(
      getFormatsByTeamCount(14).includes('4_groups_3_3_4_4_quarterfinals'),
      true,
    );
    assert.deepEqual(
      getFormatsByTeamCount(8).includes('2_groups_cross_full_repechage_semis'),
      true,
    );
    assert.deepEqual(
      getFormatsByTeamCount(8).includes('2_groups_double_bracket_final'),
      true,
    );
  });

  it('gera grupos e quartas do formato 4_groups_3_3_4_4_quarterfinals', () => {
    const structure = generateTournamentStructure({
      tournamentId: 't-4',
      formatId: '4_groups_3_3_4_4_quarterfinals',
      teams: buildTeams(14),
      includeThirdPlaceMatch: true,
    });

    assert.equal(structure.groups.length, 4);
    assert.equal(structure.groups[0].teamIds.length, 3);
    assert.equal(structure.groups[1].teamIds.length, 3);
    assert.equal(structure.groups[2].teamIds.length, 4);
    assert.equal(structure.groups[3].teamIds.length, 4);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Fase de Grupos').length, 18);
    assert.equal(structure.matches.filter((match) => match.phaseName === 'Eliminatórias').length >= 8, true);
  });
});
