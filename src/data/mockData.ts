import { Tournament, Game, TournamentTeam } from '@/types/volleyball';
import { generateTournamentStructure, defaultTieBreakerOrder } from '@/lib/tournament';

const createMockTournamentTeams = (): TournamentTeam[] => [
  {
    id: 'team-1',
    seed: 1,
    team: {
      name: 'Equipe Solar',
      players: [
        { name: 'André Loyola', number: 1 },
        { name: 'George Souto', number: 2 },
      ],
    },
  },
  {
    id: 'team-2',
    seed: 2,
    team: {
      name: 'Praia Norte',
      players: [
        { name: 'Álvaro Filho', number: 1 },
        { name: 'Luciano Ferreira', number: 2 },
      ],
    },
  },
  {
    id: 'team-3',
    seed: 3,
    team: {
      name: 'Tormenta Litorânea',
      players: [
        { name: 'Rafael Costa', number: 1 },
        { name: 'Miguel Nobre', number: 2 },
      ],
    },
  },
  {
    id: 'team-4',
    seed: 4,
    team: {
      name: 'Mar Azul',
      players: [
        { name: 'João Silva', number: 1 },
        { name: 'Pedro Santos', number: 2 },
      ],
    },
  },
  {
    id: 'team-5',
    seed: 5,
    team: {
      name: 'Ilha Dourada',
      players: [
        { name: 'Carlos Lima', number: 1 },
        { name: 'Eduardo Braga', number: 2 },
      ],
    },
  },
  {
    id: 'team-6',
    seed: 6,
    team: {
      name: 'Areia Vermelha',
      players: [
        { name: 'Henrique Prado', number: 1 },
        { name: 'Lucas Neves', number: 2 },
      ],
    },
  },
  {
    id: 'team-7',
    seed: 7,
    team: {
      name: 'Brisa Forte',
      players: [
        { name: 'Samuel Barros', number: 1 },
        { name: 'Thiago Leme', number: 2 },
      ],
    },
  },
  {
    id: 'team-8',
    seed: 8,
    team: {
      name: 'Onda Veloz',
      players: [
        { name: 'Vitor Queiroz', number: 1 },
        { name: 'Igor Dourado', number: 2 },
      ],
    },
  },
  {
    id: 'team-9',
    seed: 9,
    team: {
      name: 'Costa Serena',
      players: [
        { name: 'Bruno Neiva', number: 1 },
        { name: 'Diego Fonseca', number: 2 },
      ],
    },
  },
  {
    id: 'team-10',
    seed: 10,
    team: {
      name: 'Atlântico Norte',
      players: [
        { name: 'Gabriel Lima', number: 1 },
        { name: 'Rodrigo Azevedo', number: 2 },
      ],
    },
  },
  {
    id: 'team-11',
    seed: 11,
    team: {
      name: 'Sereias do Sol',
      players: [
        { name: 'Duda Lisboa', number: 1 },
        { name: 'Ana Patrícia', number: 2 },
      ],
    },
  },
  {
    id: 'team-12',
    seed: 12,
    team: {
      name: 'Marujo Real',
      players: [
        { name: 'Bárbara Seixas', number: 1 },
        { name: 'Carol Solberg', number: 2 },
      ],
    },
  },
];

export const mockTournaments: Tournament[] = [
  {
    id: '1',
    name: 'Campeonato Brasileiro de Vôlei de Praia 2024',
    status: 'active',
    location: 'Copacabana, Rio de Janeiro',
    startDate: '2024-08-15',
    endDate: '2024-08-25',
    games: [],
  },
  {
    id: '2',
    name: 'Circuito Nacional - Etapa Salvador',
    status: 'active',
    location: 'Praia de Ipanema, Salvador',
    startDate: '2024-08-20',
    endDate: '2024-08-22',
    games: [],
  },
  {
    id: '3',
    name: 'Copa Nordeste de Vôlei de Praia',
    status: 'upcoming',
    location: 'Fortaleza, CE',
    startDate: '2024-09-01',
    endDate: '2024-09-05',
    games: [],
  }
];

export const mockGames: Game[] = [
  {
    id: 'game-1',
    tournamentId: '1',
    title: 'Semifinal Masculina',
    category: 'M',
    modality: 'dupla',
    format: 'melhorDe3',
    teamA: {
      name: 'Brasil A',
      players: [
        { name: 'André Loyola', number: 1 },
        { name: 'George Souto', number: 2 }
      ]
    },
    teamB: {
      name: 'Brasil B', 
      players: [
        { name: 'Álvaro Filho', number: 1 },
        { name: 'Luciano Ferreira', number: 2 }
      ]
    },
    pointsPerSet: [21, 21, 15],
    needTwoPointLead: true,
    sideSwitchSum: [7, 7, 5],
    hasTechnicalTimeout: true,
    technicalTimeoutSum: 21,
    teamTimeoutsPerSet: 1,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    status: 'em_andamento',
    createdAt: '2024-08-22T10:00:00Z',
    updatedAt: '2024-08-22T14:30:00Z',
    gameState: {
      id: 'state-1',
      gameId: 'game-1',
      currentSet: 1,
      setsWon: { teamA: 0, teamB: 0 },
      scores: { teamA: [12], teamB: [8] },
      currentServerTeam: 'A',
      currentServerPlayer: 1,
      possession: 'A',
      leftIsTeamA: true,
      timeoutsUsed: { teamA: [0], teamB: [0] },
      technicalTimeoutUsed: [false],
      sidesSwitched: [0],
      serviceOrders: { teamA: [1, 2], teamB: [1, 2] },
      nextServerIndex: { teamA: 1, teamB: 0 },
      setConfigurations: [
        {
          setNumber: 1,
          isConfigured: true,
          firstChoiceTeam: 'A',
          firstChoiceOption: 'serve',
          secondChoiceOption: 'side',
          sideChoiceTeam: 'B',
          sideSelection: 'left',
          startingServerTeam: 'A',
          startingReceiverTeam: 'B',
          startingServerPlayer: 1,
          coinToss: { performed: true, winner: 'A', loser: 'B' },
          teams: {
            teamA: {
              jerseyAssignment: { '1': 0, '2': 1 },
              serviceOrder: [1, 2]
            },
            teamB: {
              jerseyAssignment: { '1': 0, '2': 1 },
              serviceOrder: [1, 2]
            }
          }
        }
      ],
      events: [],
      isGameEnded: false
    }
  },
  {
    id: 'game-2',
    tournamentId: '1',
    title: 'Final Feminina',
    category: 'F',
    modality: 'dupla',
    format: 'melhorDe3',
    teamA: {
      name: 'Brasil Feminino A',
      players: [
        { name: 'Duda Lisboa', number: 1 },
        { name: 'Ana Patrícia', number: 2 }
      ]
    },
    teamB: {
      name: 'Brasil Feminino B',
      players: [
        { name: 'Bárbara Seixas', number: 1 },
        { name: 'Carol Solberg', number: 2 }
      ]
    },
    pointsPerSet: [21, 21, 15],
    needTwoPointLead: true,
    sideSwitchSum: [7, 7, 5],
    hasTechnicalTimeout: true,
    technicalTimeoutSum: 21,
    teamTimeoutsPerSet: 1,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    status: 'agendado',
    createdAt: '2024-08-22T09:00:00Z',
    updatedAt: '2024-08-22T09:00:00Z'
  },
  {
    id: 'game-3',
    tournamentId: '2',
    title: 'Quartas de Final - Jogo 1',
    category: 'M',
    modality: 'dupla',
    format: 'melhorDe3',
    teamA: {
      name: 'Salvador A',
      players: [
        { name: 'João Silva', number: 1 },
        { name: 'Pedro Santos', number: 2 }
      ]
    },
    teamB: {
      name: 'Salvador B',
      players: [
        { name: 'Carlos Lima', number: 1 },
        { name: 'Rafael Costa', number: 2 }
      ]
    },
    pointsPerSet: [21, 21, 15],
    needTwoPointLead: true,
    sideSwitchSum: [7, 7, 5],
    hasTechnicalTimeout: true,
    technicalTimeoutSum: 21,
    teamTimeoutsPerSet: 1,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    status: 'agendado',
    createdAt: '2024-08-22T08:00:00Z',
    updatedAt: '2024-08-22T08:00:00Z'
  }
];

// Update tournaments with games
mockTournaments[0].games = [mockGames[0], mockGames[1]];
mockTournaments[1].games = [mockGames[2]];

const tournamentTeams = createMockTournamentTeams();
const structure = generateTournamentStructure({
  tournamentId: mockTournaments[0].id,
  formatId: 'groups_and_knockout',
  teams: tournamentTeams,
  includeThirdPlaceMatch: true,
});

const tournamentOneLegacyGames = [mockGames[0], mockGames[1]];

mockTournaments[0] = {
  ...mockTournaments[0],
  formatId: 'groups_and_knockout',
  tieBreakerOrder: defaultTieBreakerOrder,
  teams: tournamentTeams,
  phases: structure.phases,
  groups: structure.groups,
  matches: structure.matches,
  includeThirdPlaceMatch: true,
  games: [...structure.matches, ...tournamentOneLegacyGames],
};