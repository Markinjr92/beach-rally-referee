import { TournamentFormatId } from '@/types/volleyball';
import { BracketPhase } from '../phases';
import type {
  BracketMatchDef,
  FormatBracketDefinition,
  SlotRef,
  MatchConfigType,
} from '../types';

const P = BracketPhase;

export const g = (group: string, rank: number): SlotRef => ({
  type: 'groupRank',
  group,
  rank,
});

export const gr = (rank: number, pool: 'all' | 'cross' | 'gold' | 'silver' = 'all'): SlotRef => ({
  type: 'globalRank',
  rank,
  pool,
});

export const best = (position: 'second' | 'third', index: number): SlotRef => ({
  type: 'bestGroupRank',
  position,
  index,
});

export const w = (matchKey: string): SlotRef => ({ type: 'winner', matchKey });
export const l = (matchKey: string): SlotRef => ({ type: 'loser', matchKey });
export const seed = (n: number): SlotRef => ({ type: 'seed', seed: n });

type M = {
  key: string;
  phase: string;
  label: string;
  a: SlotRef;
  b: SlotRef;
  config?: MatchConfigType;
  third?: boolean;
  desc?: string;
};

export const m = ({
  key,
  phase,
  label,
  a,
  b,
  config,
  third,
  desc,
}: M): BracketMatchDef => ({
  key,
  phase,
  label,
  description: desc,
  teamA: a,
  teamB: b,
  configType: config,
  requiresThirdPlace: third,
});

export const qfStd = (): BracketMatchDef[] => [
  m({ key: 'SF1', phase: P.SEMIFINALS, label: 'SF1', a: w('QF1'), b: w('QF2'), config: 'semifinals' }),
  m({ key: 'SF2', phase: P.SEMIFINALS, label: 'SF2', a: w('QF3'), b: w('QF4'), config: 'semifinals' }),
];

export const finalStd = (): BracketMatchDef[] => [
  m({
    key: 'F3',
    phase: P.THIRD_PLACE,
    label: '3º lugar',
    a: l('SF1'),
    b: l('SF2'),
    config: 'thirdPlace',
    third: true,
  }),
  m({ key: 'FINAL', phase: P.FINAL, label: 'Final', a: w('SF1'), b: w('SF2'), config: 'final' }),
];

export const def = (
  formatId: TournamentFormatId,
  title: string,
  phases: string[],
  matches: BracketMatchDef[],
  extra?: Partial<FormatBracketDefinition>,
): FormatBracketDefinition => ({
  formatId,
  title,
  phases,
  matches,
  ...extra,
});

/** Quartas padrão 4 grupos A-D cruzado clássico */
export const qf4GroupsClassic = (): BracketMatchDef[] => [
  m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: g('D', 2), config: 'quarterfinals', desc: '1º Grupo A × 2º Grupo D' }),
  m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('B', 1), b: g('C', 2), config: 'quarterfinals', desc: '1º Grupo B × 2º Grupo C' }),
  m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('C', 1), b: g('B', 2), config: 'quarterfinals', desc: '1º Grupo C × 2º Grupo B' }),
  m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('D', 1), b: g('A', 2), config: 'quarterfinals', desc: '1º Grupo D × 2º Grupo A' }),
];

/** Quartas 4 grupos pareamento A-B / C-D */
export const qf4Groups3344 = (): BracketMatchDef[] => [
  m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: g('B', 2), config: 'quarterfinals' }),
  m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('B', 1), b: g('A', 2), config: 'quarterfinals' }),
  m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('C', 1), b: g('D', 2), config: 'quarterfinals' }),
  m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('D', 1), b: g('C', 2), config: 'quarterfinals' }),
];

/** Semi cruzada 2 grupos */
export const semiCross2 = (): BracketMatchDef[] => [
  m({ key: 'SF1', phase: P.SEMIFINALS, label: 'Semi 1', a: g('A', 1), b: g('B', 2), config: 'semifinals', desc: '1º A × 2º B' }),
  m({ key: 'SF2', phase: P.SEMIFINALS, label: 'Semi 2', a: g('B', 1), b: g('A', 2), config: 'semifinals', desc: '1º B × 2º A' }),
];

/** Quartas 2 grupos de 5 (top 4 cada) */
export const qf2Groups5 = (): BracketMatchDef[] => [
  m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: g('B', 4), config: 'quarterfinals' }),
  m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('A', 2), b: g('B', 3), config: 'quarterfinals' }),
  m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('A', 3), b: g('B', 2), config: 'quarterfinals' }),
  m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('A', 4), b: g('B', 1), config: 'quarterfinals' }),
];

/** Quartas 2 grupos de 4 (todos avançam) */
export const qf2Groups4 = (): BracketMatchDef[] => [
  m({ key: 'QF1', phase: P.QUARTERFINALS, label: 'QF1', a: g('A', 1), b: g('B', 4), config: 'quarterfinals' }),
  m({ key: 'QF2', phase: P.QUARTERFINALS, label: 'QF2', a: g('A', 2), b: g('B', 3), config: 'quarterfinals' }),
  m({ key: 'QF3', phase: P.QUARTERFINALS, label: 'QF3', a: g('B', 1), b: g('A', 4), config: 'quarterfinals' }),
  m({ key: 'QF4', phase: P.QUARTERFINALS, label: 'QF4', a: g('B', 2), b: g('A', 3), config: 'quarterfinals' }),
];

export const phasesKnockoutStd = [
  P.GROUPS,
  P.QUARTERFINALS,
  P.SEMIFINALS,
  P.FINAL,
];

export const phasesSemiFinal = [P.GROUPS, P.SEMIFINALS, P.FINAL];

/** 8 equipes, chave única com classificação 1º a 8º (sem grupos) */
export const knockout8FullPlacement = (): BracketMatchDef[] => [
  m({
    key: 'QF1',
    phase: P.QUARTERFINALS,
    label: 'Jogo 1',
    a: seed(1),
    b: seed(2),
    config: 'quarterfinals',
    desc: 'Equipe 1 × Equipe 2',
  }),
  m({
    key: 'QF2',
    phase: P.QUARTERFINALS,
    label: 'Jogo 2',
    a: seed(3),
    b: seed(4),
    config: 'quarterfinals',
    desc: 'Equipe 3 × Equipe 4',
  }),
  m({
    key: 'QF3',
    phase: P.QUARTERFINALS,
    label: 'Jogo 3',
    a: seed(5),
    b: seed(6),
    config: 'quarterfinals',
    desc: 'Equipe 5 × Equipe 6',
  }),
  m({
    key: 'QF4',
    phase: P.QUARTERFINALS,
    label: 'Jogo 4',
    a: seed(7),
    b: seed(8),
    config: 'quarterfinals',
    desc: 'Equipe 7 × Equipe 8',
  }),
  m({
    key: 'SF1',
    phase: P.SEMIFINALS,
    label: 'Jogo 5',
    a: w('QF1'),
    b: w('QF2'),
    config: 'semifinals',
    desc: 'Ganhador do Jogo 1 × Ganhador do Jogo 2',
  }),
  m({
    key: 'SF2',
    phase: P.SEMIFINALS,
    label: 'Jogo 6',
    a: w('QF3'),
    b: w('QF4'),
    config: 'semifinals',
    desc: 'Ganhador do Jogo 3 × Ganhador do Jogo 4',
  }),
  m({
    key: 'SF3',
    phase: P.SEMIFINALS,
    label: 'Jogo 9',
    a: l('QF1'),
    b: l('QF2'),
    config: 'semifinals',
    desc: 'Perdedor do Jogo 1 × Perdedor do Jogo 2',
  }),
  m({
    key: 'SF4',
    phase: P.SEMIFINALS,
    label: 'Jogo 10',
    a: l('QF3'),
    b: l('QF4'),
    config: 'semifinals',
    desc: 'Perdedor do Jogo 3 × Perdedor do Jogo 4',
  }),
  m({
    key: 'FINAL',
    phase: P.FINALS,
    label: 'Jogo 7',
    a: w('SF1'),
    b: w('SF2'),
    config: 'final',
    desc: 'Ganhador do Jogo 5 × Ganhador do Jogo 6 — disputa de 1º lugar',
  }),
  m({
    key: 'F3',
    phase: P.FINALS,
    label: 'Jogo 8',
    a: l('SF1'),
    b: l('SF2'),
    config: 'thirdPlace',
    desc: 'Perdedor do Jogo 5 × Perdedor do Jogo 6 — disputa de 3º lugar',
  }),
  m({
    key: 'F5',
    phase: P.FINALS,
    label: 'Jogo 11',
    a: w('SF3'),
    b: w('SF4'),
    config: 'semifinals',
    desc: 'Ganhador do Jogo 9 × Ganhador do Jogo 10 — disputa de 5º lugar',
  }),
  m({
    key: 'F7',
    phase: P.FINALS,
    label: 'Jogo 12',
    a: l('SF3'),
    b: l('SF4'),
    config: 'semifinals',
    desc: 'Perdedor do Jogo 9 × Perdedor do Jogo 10 — disputa de 7º lugar',
  }),
];
