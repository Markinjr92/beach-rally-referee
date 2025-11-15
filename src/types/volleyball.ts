export type TournamentFormatId =
  | 'groups_and_knockout'
  | 'double_elimination'
  | 'global_semis'
  | 'series_gold_silver'
  | 'single_elimination'
  | '3_groups_quarterfinals'
  | '2_groups_5_quarterfinals';

export type TieBreakerCriterion =
  | 'head_to_head'
  | 'sets_average_inner'
  | 'points_average_inner'
  | 'sets_average_global'
  | 'points_average_global'
  | 'random_draw';

export interface TournamentTeam {
  id: string;
  seed: number;
  team: Team;
}

export interface TournamentPhase {
  id: string;
  name: string;
  order: number;
  type: 'group' | 'knockout' | 'double_elimination' | 'series';
  description?: string;
}

export interface TournamentGroup {
  id: string;
  name: string;
  phaseId: string;
  teamIds: string[];
}

export interface MatchSetResult {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
}

export interface TournamentMatchResult {
  winner: 'A' | 'B';
  sets: MatchSetResult[];
  forfeitedBy?: 'A' | 'B';
  finishedAt?: string;
}

export interface TournamentMatch extends Game {
  phaseId: string;
  phaseName: string;
  round: number;
  groupId?: string;
  groupName?: string;
  tableId?: string;
  scheduledAt?: string;
  teamAId?: string;
  teamBId?: string;
  result?: TournamentMatchResult;
}

export interface TournamentStanding {
  teamId: string;
  teamName: string;
  seed: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  matchPoints: number;
  tieBreakValues: Partial<Record<TieBreakerCriterion, number>>;
}

export interface Tournament {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'upcoming';
  location: string;
  startDate: string;
  endDate: string;
  games: Game[];
  formatId?: TournamentFormatId;
  tieBreakerOrder?: TieBreakerCriterion[];
  teams?: TournamentTeam[];
  phases?: TournamentPhase[];
  groups?: TournamentGroup[];
  matches?: TournamentMatch[];
  includeThirdPlaceMatch?: boolean;
  regulationHtml?: string;
}

export interface Team {
  name: string;
  players: Player[];
}

export interface Player {
  name: string;
  number: number;
}

export interface GameConfiguration {
  id: string;
  tournamentId: string;
  title: string;
  category: string; // F/M/Misto
  modality: 'dupla' | 'quarteto';
  format: 'melhorDe1' | 'melhorDe3' | 'melhorDe3_15' | 'melhorDe3_15_10';
  teamA: Team;
  teamB: Team;
  pointsPerSet: number[]; // [21, 21, 15]
  needTwoPointLead: boolean;
  sideSwitchSum: number[]; // [7, 7, 5]
  hasTechnicalTimeout: boolean;
  technicalTimeoutSum: number;
  teamTimeoutsPerSet: number;
  teamTimeoutDurationSec: number;
  coinTossMode: 'initialThenAlternate';
  notes?: string;
  status: 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado';
  createdAt: string;
  updatedAt: string;
  hasStatistics?: boolean;
}

export type CoinChoice = 'side' | 'serve' | 'receive';
export type CourtSide = 'left' | 'right';

export interface TeamSetConfiguration {
  jerseyAssignment: Record<string, number>;
  serviceOrder: number[];
}

export interface CoinTossConfiguration {
  performed: boolean;
  winner?: 'A' | 'B';
  loser?: 'A' | 'B';
}

export interface SetConfiguration {
  setNumber: number;
  isConfigured: boolean;
  firstChoiceTeam: 'A' | 'B';
  firstChoiceOption: CoinChoice;
  firstChoiceSide?: CourtSide;
  secondChoiceOption: CoinChoice;
  secondChoiceSide?: CourtSide;
  sideChoiceTeam: 'A' | 'B';
  sideSelection: CourtSide;
  startingServerTeam: 'A' | 'B';
  startingReceiverTeam: 'A' | 'B';
  startingServerPlayer: number;
  coinToss: CoinTossConfiguration;
  teams: {
    teamA: TeamSetConfiguration;
    teamB: TeamSetConfiguration;
  };
}

export interface GameState {
  id: string;
  gameId: string;
  currentSet: number;
  setsWon: { teamA: number; teamB: number };
  scores: { teamA: number[]; teamB: number[] }; // scores per set
  currentServerTeam: 'A' | 'B';
  currentServerPlayer: number; // 1-4
  possession: 'A' | 'B';
  leftIsTeamA: boolean; // for court side switching
  timeoutsUsed: { teamA: number[]; teamB: number[] }; // per set
  technicalTimeoutUsed: boolean[];
  sidesSwitched: number[]; // track switches per set
  serviceOrders: { teamA: number[]; teamB: number[] };
  nextServerIndex: { teamA: number; teamB: number };
  setConfigurations: SetConfiguration[];
  events?: GameEvent[];
  activeTimer?: Timer | null;
  isGameEnded: boolean;
}

export interface GameEvent {
  id: string;
  type: 'POINT' | 'TIMEOUT_TEAM' | 'TIMEOUT_TECHNICAL' | 'SIDE_SWITCH' | 'SET_END' | 'GAME_END' | 'OVERRIDE';
  timestamp: string;
  team?: 'A' | 'B';
  data: unknown;
  // Additional metadata attached to the event.
  pointCategory?: PointCategory;
}

export interface Timer {
  id: string;
  type: 'TIMEOUT_TEAM' | 'TIMEOUT_TECHNICAL' | 'SET_INTERVAL' | 'MEDICAL';
  startedAt: string;
  endsAt: string;
  durationSec: number;
  team?: 'A' | 'B';
}

export type PointCategory =
  | 'ATTACK'
  | 'BLOCK'
  | 'SERVE_POINT'
  | 'OPPONENT_ERROR';

export interface Game extends GameConfiguration {
  gameState?: GameState;
}

export interface Statistics {
  teamA: TeamStats;
  teamB: TeamStats;
}

export interface TeamStats {
  points: { [key in PointCategory]: number };
  totalPoints: number;
  aces: number;
  errors: number;
  attacks: number;
  blocks: number;
}