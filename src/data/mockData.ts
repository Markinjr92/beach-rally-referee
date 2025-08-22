import { Tournament, Game } from '@/types/volleyball';

export const mockTournaments: Tournament[] = [
  {
    id: '1',
    name: 'Campeonato Brasileiro de Vôlei de Praia 2024',
    status: 'active',
    location: 'Copacabana, Rio de Janeiro',
    startDate: '2024-08-15',
    endDate: '2024-08-25',
    games: []
  },
  {
    id: '2', 
    name: 'Circuito Nacional - Etapa Salvador',
    status: 'active',
    location: 'Praia de Ipanema, Salvador',
    startDate: '2024-08-20',
    endDate: '2024-08-22',
    games: []
  },
  {
    id: '3',
    name: 'Copa Nordeste de Vôlei de Praia',
    status: 'upcoming',
    location: 'Fortaleza, CE',
    startDate: '2024-09-01',
    endDate: '2024-09-05',
    games: []
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