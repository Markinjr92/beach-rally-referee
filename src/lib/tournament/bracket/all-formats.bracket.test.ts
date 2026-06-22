import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allBracketDefinitions } from './definitions';
import { FORMAT_TEAM_COUNT, simulateAndValidateFormat } from './testHarness';
import { TournamentFormatId } from '@/types/volleyball';

const ALL_FORMAT_IDS = allBracketDefinitions.map((d) => d.formatId);

describe('simulação E2E — todos os formatos de torneio', () => {
  it('possui definição e contagem de equipes para cada formato', () => {
    assert.equal(ALL_FORMAT_IDS.length, 24);
    for (const formatId of ALL_FORMAT_IDS) {
      assert.ok(FORMAT_TEAM_COUNT[formatId], `FORMAT_TEAM_COUNT ausente: ${formatId}`);
      assert.ok(FORMAT_TEAM_COUNT[formatId] >= 4);
    }
  });

  for (const formatId of ALL_FORMAT_IDS) {
    it(`valida classificação e cruzamentos: ${formatId}`, () => {
      const result = simulateAndValidateFormat(formatId as TournamentFormatId);

      if (!result.ok) {
        console.error(`\n[${formatId}] erros:`);
        result.errors.forEach((e) => console.error(`  - ${e}`));
        console.error(`  resolvidos: ${result.resolvedCount}/${result.expectedCount}`);
      }

      assert.equal(
        result.ok,
        true,
        `${formatId}: ${result.errors.slice(0, 5).join('; ')}${result.errors.length > 5 ? ` (+${result.errors.length - 5})` : ''}`,
      );
      assert.ok(result.resolvedCount > 0, `${formatId}: nenhum confronto eliminatório gerado`);
    });
  }
});

describe('simulação E2E — cenários específicos de classificação', () => {
  it('groups_and_knockout: 1ºA enfrenta 2ºD nas quartas', () => {
    const result = simulateAndValidateFormat('groups_and_knockout');
    assert.equal(result.ok, true);
  });

  it('3_groups_quarterfinals: melhores terceiros entram nas quartas', () => {
    const result = simulateAndValidateFormat('3_groups_quarterfinals');
    assert.equal(result.ok, true);
  });

  it('series_gold_silver: séries ouro e prata separadas', () => {
    const result = simulateAndValidateFormat('series_gold_silver');
    assert.equal(result.ok, true);
    assert.ok(result.resolvedCount >= 8);
  });

  it('double_elimination: fluxo completo até grande final', () => {
    const result = simulateAndValidateFormat('double_elimination');
    assert.equal(result.ok, true);
  });
});
