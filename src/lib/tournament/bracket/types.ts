import { TournamentFormatId, TieBreakerCriterion } from '@/types/volleyball';
import { Tables } from '@/integrations/supabase/types';

export type MatchRow = Tables<'matches'>;
export type MatchScoreRow = Tables<'match_scores'>;
export type TeamRow = Tables<'teams'>;

export type MatchConfigType = 'groups' | 'quarterfinals' | 'semifinals' | 'final' | 'thirdPlace';

/** Referência a uma vaga no confronto */
export type SlotRef =
  | { type: 'groupRank'; group: string; rank: number }
  | { type: 'globalRank'; rank: number; pool?: 'all' | 'cross' | 'gold' | 'silver' }
  | { type: 'bestGroupRank'; position: 'second' | 'third'; index: number }
  | { type: 'winner'; matchKey: string }
  | { type: 'loser'; matchKey: string }
  | { type: 'seed'; seed: number };

export type BracketMatchDef = {
  /** Identificador estável (ex.: QF1, SF2, R1-1) */
  key: string;
  phase: string;
  label: string;
  description?: string;
  teamA: SlotRef;
  teamB: SlotRef;
  configType?: MatchConfigType;
  /** Se false, não gera mesmo com includeThirdPlace desligado */
  requiresThirdPlace?: boolean;
  /** Ordem dentro da fase para pareamento estável */
  order?: number;
};

export type BracketInfoSection = {
  phase: string;
  matches: Array<{ label: string; description: string; phaseOverride?: string }>;
};

export type FormatBracketDefinition = {
  formatId: TournamentFormatId;
  title: string;
  /** Sequência lógica de fases para navegação */
  phases: string[];
  /** Classificação usa jogos cruzados entre grupos */
  crossGroupStandings?: boolean;
  /** Grupos que devem estar completos para ranking global */
  globalRankingRequiresAllGroups?: boolean;
  matches: BracketMatchDef[];
  /** Seções informativas (fase de grupos, classificação, etc.) */
  infoSections?: BracketInfoSection[];
};

export type GroupStandingEntry = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  matchPoints: number;
};

export type GroupQualifiers = {
  groupKey: string;
  first: string;
  second: string;
  third?: string;
  fourth?: string;
  standings: GroupStandingEntry[];
  isComplete: boolean;
};

export type BracketContext = {
  formatId: TournamentFormatId;
  definition: FormatBracketDefinition;
  tieBreakerOrder: TieBreakerCriterion[];
  includeThirdPlace: boolean;
  groups: GroupQualifiers[];
  globalRanking: GroupStandingEntry[];
  crossGlobalRanking: GroupStandingEntry[];
  goldRanking: GroupStandingEntry[];
  silverRanking: GroupStandingEntry[];
  bestSeconds: GroupStandingEntry[];
  bestThirds: GroupStandingEntry[];
  matchByKey: Map<string, MatchRow>;
  matchWinners: Map<string, string>;
  matchLosers: Map<string, string>;
  groupLabels: string[];
  seedMap: Map<number, string>;
};

export type ResolvedMatch = {
  key: string;
  phase: string;
  teamAId: string;
  teamBId: string;
  configType: MatchConfigType;
};

export type BracketSyncResult = {
  created: number;
  updated: number;
  skipped: number;
  resolved: ResolvedMatch[];
};
