import { TournamentFormatId } from '@/types/volleyball';
import { BracketPhase } from '../phases';
import type { FormatBracketDefinition } from '../types';
import {
  best,
  def,
  finalStd,
  g,
  gr,
  l,
  m,
  phasesKnockoutStd,
  phasesSemiFinal,
  qf2Groups4,
  qf2Groups5,
  qf4Groups3344,
  qf4GroupsClassic,
  qfStd,
  seed,
  semiCross2,
  w,
} from './builders';

const P = BracketPhase;

const groupsToFinal: FormatBracketDefinition[] = [
  def(
    'groups_and_knockout',
    'Grupos + Eliminatória (4 grupos de 3)',
    phasesKnockoutStd,
    [...qf4GroupsClassic(), ...qfStd(), ...finalStd()],
  ),
  def(
    '4_groups_3_3_4_4_quarterfinals',
    '4 Grupos (3-3-4-4) + Quartas',
    phasesKnockoutStd,
    [...qf4Groups3344(), ...qfStd(), ...finalStd()],
  ),
  def(
    '3_groups_quarterfinals',
    '3 Grupos + Quartas com melhores 3º',
    phasesKnockoutStd,
    [
      m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: best('third', 0), config: 'quarterfinals' }),
      m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('B', 1), b: g('C', 2), config: 'quarterfinals' }),
      m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('C', 1), b: g('B', 2), config: 'quarterfinals' }),
      m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('A', 2), b: best('third', 1), config: 'quarterfinals' }),
      ...qfStd(),
      ...finalStd(),
    ],
  ),
  def(
    '2_groups_5_quarterfinals',
    '2 Grupos de 5 + Quartas, Semi e Final',
    phasesKnockoutStd,
    [...qf2Groups5(), ...qfStd(), ...finalStd()],
  ),
  def(
    '2_groups_4_quarterfinals',
    '2 Grupos de 4 + Quartas, Semi e Final',
    phasesKnockoutStd,
    [...qf2Groups4(), ...qfStd(), ...finalStd()],
  ),
  def(
    '3_groups_3_quarterfinals',
    '3 Grupos de 3 - Quartas de Final',
    phasesKnockoutStd,
    [
      m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: best('second', 0), config: 'quarterfinals' }),
      m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('B', 1), b: best('second', 1), config: 'quarterfinals' }),
      m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('C', 1), b: best('second', 2), config: 'quarterfinals' }),
      m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('A', 2), b: best('third', 0), config: 'quarterfinals' }),
      ...qfStd(),
      ...finalStd(),
    ],
  ),
  def(
    '5_groups_3_quarterfinals',
    '5 Grupos de 3 - Quartas de Final',
    phasesKnockoutStd,
    [
      m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: best('second', 0), config: 'quarterfinals' }),
      m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('B', 1), b: best('second', 1), config: 'quarterfinals' }),
      m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('C', 1), b: best('second', 2), config: 'quarterfinals' }),
      m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('D', 1), b: g('E', 1), config: 'quarterfinals' }),
      ...qfStd(),
      ...finalStd(),
    ],
  ),
];

const semiFormats: FormatBracketDefinition[] = [
  def('2_groups_5_semis', '2 Grupos de 5 - Semi/Final', phasesSemiFinal, [
    ...semiCross2(),
    ...finalStd(),
  ]),
  def('2_groups_4_semis', '2 Grupos de 4 - Semi/Final', phasesSemiFinal, [
    ...semiCross2(),
    ...finalStd(),
  ]),
  def('2_groups_5_4_semis', '2 Grupos 5+4 - Semi/Final', phasesSemiFinal, [
    ...semiCross2(),
    ...finalStd(),
  ]),
  def('2_groups_6_cross_semis', '2 Grupos de 6 - Cruzado + Semi/Final', phasesSemiFinal, [
    ...semiCross2(),
    ...finalStd(),
  ], { crossGroupStandings: true }),
  def('2_groups_3_cross_semis', '2 Grupos de 3 - Cruzado + Semi/Final', phasesSemiFinal, [
    m({ key: 'SF1', phase: P.SEMIFINALS, label: 'Semi 1', a: g('A', 1), b: g('A', 2), config: 'semifinals' }),
    m({ key: 'SF2', phase: P.SEMIFINALS, label: 'Semi 2', a: g('B', 1), b: g('B', 2), config: 'semifinals' }),
    ...finalStd(),
  ], { crossGroupStandings: true }),
  def('3_groups_3_semis', '3 Grupos de 3 - Semifinais', phasesSemiFinal, [
    m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: g('A', 1), b: best('second', 0), config: 'semifinals' }),
    m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: g('B', 1), b: g('C', 1), config: 'semifinals' }),
    ...finalStd(),
  ]),
  def('global_semis', '3 Grupos + Semifinais gerais', phasesSemiFinal, [
    m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: gr(1), b: gr(4), config: 'semifinals' }),
    m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: gr(2), b: gr(3), config: 'semifinals' }),
    ...finalStd(),
  ], { globalRankingRequiresAllGroups: true }),
];

const repechageFormats: FormatBracketDefinition[] = [
  def(
    '2_groups_3_repescagem_semis',
    '2 Grupos de 3 - Repescagem + Semi/Final',
    [P.GROUPS, P.REPECHAGE, P.SEMIFINALS, P.FINAL],
    [
      m({ key: 'REP1', phase: P.REPECHAGE, label: 'Repescagem 1', a: g('A', 2), b: g('B', 3), config: 'quarterfinals' }),
      m({ key: 'REP2', phase: P.REPECHAGE, label: 'Repescagem 2', a: g('B', 2), b: g('A', 3), config: 'quarterfinals' }),
      m({ key: 'SF1', phase: P.SEMIFINALS, label: 'Semi 1', a: g('A', 1), b: w('REP2'), config: 'semifinals' }),
      m({ key: 'SF2', phase: P.SEMIFINALS, label: 'Semi 2', a: g('B', 1), b: w('REP1'), config: 'semifinals' }),
      ...finalStd(),
    ],
  ),
  def(
    '3_groups_4_repechage_quarterfinals',
    '3 Grupos de 4 + Repescagem + Quartas',
    [P.GROUPS, P.REPECHAGE, P.QUARTERFINALS, P.SEMIFINALS, P.FINAL],
    [
      m({ key: 'R1', phase: P.REPECHAGE, label: 'R1', a: gr(5), b: gr(12), config: 'quarterfinals' }),
      m({ key: 'R2', phase: P.REPECHAGE, label: 'R2', a: gr(6), b: gr(11), config: 'quarterfinals' }),
      m({ key: 'R3', phase: P.REPECHAGE, label: 'R3', a: gr(7), b: gr(10), config: 'quarterfinals' }),
      m({ key: 'R4', phase: P.REPECHAGE, label: 'R4', a: gr(8), b: gr(9), config: 'quarterfinals' }),
      m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: gr(1), b: w('R4'), config: 'quarterfinals' }),
      m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: gr(2), b: w('R3'), config: 'quarterfinals' }),
      m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: gr(3), b: w('R2'), config: 'quarterfinals' }),
      m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: gr(4), b: w('R1'), config: 'quarterfinals' }),
      m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: w('QF1'), b: w('QF4'), config: 'semifinals' }),
      m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: w('QF2'), b: w('QF3'), config: 'semifinals' }),
      ...finalStd(),
    ],
    { globalRankingRequiresAllGroups: true },
  ),
  def(
    '2_groups_cross_full_repechage_semis',
    '2 Grupos de 4 (Cruzado Completo) + Repescagem + Semifinal',
    [P.GROUPS, P.REPECHAGE, P.SEMIFINALS, P.FINAL],
    [
      m({ key: 'R1', phase: P.REPECHAGE, label: 'R1', a: gr(3, 'cross'), b: gr(6, 'cross'), config: 'quarterfinals' }),
      m({ key: 'R2', phase: P.REPECHAGE, label: 'R2', a: gr(4, 'cross'), b: gr(5, 'cross'), config: 'quarterfinals' }),
      m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: gr(1, 'cross'), b: w('R2'), config: 'semifinals' }),
      m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: gr(2, 'cross'), b: w('R1'), config: 'semifinals' }),
      m({ key: 'FINAL', phase: P.FINAL, label: 'Final', a: w('SF1'), b: w('SF2'), config: 'final' }),
    ],
    { crossGroupStandings: true, globalRankingRequiresAllGroups: true },
  ),
];

const specialFormats: FormatBracketDefinition[] = [
  def(
    '2_groups_double_bracket_final',
    '2 Grupos de 4 + Chave Dupla + Final',
    [P.GROUPS, P.SEMIFINALS, P.FINAL],
    [
      m({ key: 'GA-J3', phase: P.GROUPS, label: 'Grupo A - J3', a: w('GA-J1'), b: w('GA-J2'), config: 'groups' }),
      m({ key: 'GA-J4', phase: P.GROUPS, label: 'Grupo A - J4', a: l('GA-J1'), b: l('GA-J2'), config: 'groups' }),
      m({ key: 'GB-J3', phase: P.GROUPS, label: 'Grupo B - J3', a: w('GB-J1'), b: w('GB-J2'), config: 'groups' }),
      m({ key: 'GB-J4', phase: P.GROUPS, label: 'Grupo B - J4', a: l('GB-J1'), b: l('GB-J2'), config: 'groups' }),
      m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: w('GA-J3'), b: w('GB-J3'), config: 'semifinals' }),
      m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: w('GA-J4'), b: w('GB-J4'), config: 'semifinals' }),
      ...finalStd(),
    ],
  ),
  def(
    'series_gold_silver',
    'Séries Ouro e Prata',
    [P.GROUPS, P.SERIES_GOLD, P.SERIES_SILVER],
    [
      m({ key: 'SFO1', phase: P.SERIES_GOLD, label: 'SF Ouro 1', a: gr(1, 'gold'), b: gr(4, 'gold'), config: 'semifinals' }),
      m({ key: 'SFO2', phase: P.SERIES_GOLD, label: 'SF Ouro 2', a: gr(2, 'gold'), b: gr(3, 'gold'), config: 'semifinals' }),
      m({ key: 'F3O', phase: P.THIRD_GOLD, label: '3º Ouro', a: l('SFO1'), b: l('SFO2'), config: 'thirdPlace', third: true }),
      m({ key: 'FO', phase: P.FINAL_GOLD, label: 'Final Ouro', a: w('SFO1'), b: w('SFO2'), config: 'final' }),
      m({ key: 'SFP1', phase: P.SERIES_SILVER, label: 'SF Prata 1', a: gr(1, 'silver'), b: gr(4, 'silver'), config: 'semifinals' }),
      m({ key: 'SFP2', phase: P.SERIES_SILVER, label: 'SF Prata 2', a: gr(2, 'silver'), b: gr(3, 'silver'), config: 'semifinals' }),
      m({ key: 'F3P', phase: P.THIRD_SILVER, label: '3º Prata', a: l('SFP1'), b: l('SFP2'), config: 'thirdPlace', third: true }),
      m({ key: 'FP', phase: P.FINAL_SILVER, label: 'Final Prata', a: w('SFP1'), b: w('SFP2'), config: 'final' }),
    ],
    { globalRankingRequiresAllGroups: true },
  ),
  def(
    'single_elimination',
    'Eliminatória Simples',
    [P.FIRST_ROUND, P.QUARTERFINALS, P.SEMIFINALS, P.FINAL],
    [
      m({ key: 'R1-1', phase: P.FIRST_ROUND, label: 'R1-1', a: seed(5), b: seed(12), config: 'groups' }),
      m({ key: 'R1-2', phase: P.FIRST_ROUND, label: 'R1-2', a: seed(8), b: seed(9), config: 'groups' }),
      m({ key: 'R1-3', phase: P.FIRST_ROUND, label: 'R1-3', a: seed(6), b: seed(11), config: 'groups' }),
      m({ key: 'R1-4', phase: P.FIRST_ROUND, label: 'R1-4', a: seed(7), b: seed(10), config: 'groups' }),
      m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: seed(1), b: w('R1-1'), config: 'quarterfinals' }),
      m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: seed(4), b: w('R1-2'), config: 'quarterfinals' }),
      m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: seed(3), b: w('R1-3'), config: 'quarterfinals' }),
      m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: seed(2), b: w('R1-4'), config: 'quarterfinals' }),
      ...qfStd(),
      ...finalStd(),
    ],
  ),
];

const roundRobinFormats: FormatBracketDefinition[] = [
  def('6_teams_round_robin', '6 Duplas - Todos contra Todos + Final', [P.GROUPS, P.FINALS], [
    m({ key: 'FINAL', phase: P.FINAL, label: 'Final', a: gr(1), b: gr(2), config: 'final' }),
    m({ key: 'F3', phase: P.THIRD_PLACE, label: '3º lugar', a: gr(3), b: gr(4), config: 'thirdPlace', third: true }),
  ], { globalRankingRequiresAllGroups: true }),
  def('5_teams_round_robin', '5 Duplas - Todos contra Todos + Final', [P.GROUPS, P.FINALS], [
    m({ key: 'FINAL', phase: P.FINAL, label: 'Final', a: gr(1), b: gr(2), config: 'final' }),
    m({ key: 'F3', phase: P.THIRD_PLACE, label: '3º lugar', a: gr(3), b: gr(4), config: 'thirdPlace', third: true }),
  ], { globalRankingRequiresAllGroups: true }),
  def('4_teams_round_robin', '4 Duplas - Todos contra Todos + Final', [P.GROUPS, P.FINALS], [
    m({ key: 'FINAL', phase: P.FINAL, label: 'Final', a: gr(1), b: gr(2), config: 'final' }),
    m({ key: 'F3', phase: P.THIRD_PLACE, label: '3º lugar', a: gr(3), b: gr(4), config: 'thirdPlace', third: true }),
  ], { globalRankingRequiresAllGroups: true }),
];

/** Eliminatória dupla — chave principal + repescagem (fases padronizadas) */
const doubleElimination: FormatBracketDefinition = def(
  'double_elimination',
  'Eliminatória Dupla',
  [P.WINNERS_R1, P.WINNERS_R2, P.REPECHAGE, P.SEMIFINALS, P.FINAL],
  [
    m({ key: 'WR1-1', phase: P.WINNERS_R1, label: 'WR1-1', a: seed(5), b: seed(12), config: 'groups' }),
    m({ key: 'WR1-2', phase: P.WINNERS_R1, label: 'WR1-2', a: seed(8), b: seed(9), config: 'groups' }),
    m({ key: 'WR1-3', phase: P.WINNERS_R1, label: 'WR1-3', a: seed(6), b: seed(11), config: 'groups' }),
    m({ key: 'WR1-4', phase: P.WINNERS_R1, label: 'WR1-4', a: seed(7), b: seed(10), config: 'groups' }),
    m({ key: 'WR2-1', phase: P.WINNERS_R2, label: 'WR2-1', a: seed(1), b: w('WR1-1'), config: 'quarterfinals' }),
    m({ key: 'WR2-2', phase: P.WINNERS_R2, label: 'WR2-2', a: seed(4), b: w('WR1-2'), config: 'quarterfinals' }),
    m({ key: 'WR2-3', phase: P.WINNERS_R2, label: 'WR2-3', a: seed(3), b: w('WR1-3'), config: 'quarterfinals' }),
    m({ key: 'WR2-4', phase: P.WINNERS_R2, label: 'WR2-4', a: seed(2), b: w('WR1-4'), config: 'quarterfinals' }),
    m({ key: 'WR3-1', phase: P.SEMIFINALS, label: 'WR3-1', a: w('WR2-1'), b: w('WR2-2'), config: 'semifinals' }),
    m({ key: 'WR3-2', phase: P.SEMIFINALS, label: 'WR3-2', a: w('WR2-3'), b: w('WR2-4'), config: 'semifinals' }),
    m({ key: 'WF', phase: P.SEMIFINALS, label: 'Final Chave Vencedores', a: w('WR3-1'), b: w('WR3-2'), config: 'semifinals' }),
    m({ key: 'LR1-1', phase: P.REPECHAGE, label: 'Rep R1-1', a: l('WR1-1'), b: l('WR1-2'), config: 'quarterfinals' }),
    m({ key: 'LR1-2', phase: P.REPECHAGE, label: 'Rep R1-2', a: l('WR1-3'), b: l('WR1-4'), config: 'quarterfinals' }),
    m({ key: 'LR2-1', phase: P.REPECHAGE, label: 'Rep R2-1', a: l('WR2-1'), b: w('LR1-1'), config: 'quarterfinals' }),
    m({ key: 'LR2-2', phase: P.REPECHAGE, label: 'Rep R2-2', a: l('WR2-2'), b: w('LR1-2'), config: 'quarterfinals' }),
    m({ key: 'LR3-1', phase: P.REPECHAGE, label: 'Rep R3-1', a: l('WR2-3'), b: w('LR2-1'), config: 'quarterfinals' }),
    m({ key: 'LR3-2', phase: P.REPECHAGE, label: 'Rep R3-2', a: l('WR2-4'), b: w('LR2-2'), config: 'quarterfinals' }),
    m({ key: 'LR4-1', phase: P.REPECHAGE, label: 'Rep R4-1', a: l('WR3-1'), b: w('LR3-1'), config: 'semifinals' }),
    m({ key: 'LR4-2', phase: P.REPECHAGE, label: 'Rep R4-2', a: l('WR3-2'), b: w('LR3-2'), config: 'semifinals' }),
    m({ key: 'LF', phase: P.REPECHAGE, label: 'Final Repescagem', a: w('LR4-1'), b: w('LR4-2'), config: 'semifinals' }),
    m({ key: 'GF', phase: P.FINAL, label: 'Grande Final', a: w('WF'), b: w('LF'), config: 'final' }),
    m({ key: 'GF2', phase: P.FINAL, label: 'Grande Final Extra', a: l('GF'), b: w('GF'), config: 'final' }),
  ],
);

export const allBracketDefinitions: FormatBracketDefinition[] = [
  ...groupsToFinal,
  ...semiFormats,
  ...repechageFormats,
  ...specialFormats,
  ...roundRobinFormats,
  doubleElimination,
];

export const bracketDefinitionsByFormat: Record<TournamentFormatId, FormatBracketDefinition> =
  allBracketDefinitions.reduce(
    (acc, d) => {
      acc[d.formatId] = d;
      return acc;
    },
    {} as Record<TournamentFormatId, FormatBracketDefinition>,
  );

export const getBracketDefinition = (formatId: TournamentFormatId): FormatBracketDefinition | null =>
  bracketDefinitionsByFormat[formatId] ?? null;

export const getPhaseSequencesFromDefinitions = (): Partial<
  Record<TournamentFormatId, string[]>
> => {
  const result: Partial<Record<TournamentFormatId, string[]>> = {};
  allBracketDefinitions.forEach((d) => {
    result[d.formatId] = d.phases;
  });
  return result;
};
