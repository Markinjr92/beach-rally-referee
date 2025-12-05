import {
  GameConfiguration,
  Team,
  TournamentFormatId,
  TournamentGroup,
  TournamentMatch,
  TournamentPhase,
  TournamentTeam,
  TieBreakerCriterion,
} from '@/types/volleyball';

export type TournamentPhaseConfigType = 'group' | 'knockout' | 'thirdPlace' | 'quarterfinals';

export type TournamentPhaseConfigs = Partial<Record<TournamentPhaseConfigType, Partial<GameConfiguration>>>;

export interface GenerateTournamentStructureOptions {
  tournamentId: string;
  formatId: TournamentFormatId;
  teams: TournamentTeam[];
  baseGameConfig?: Partial<GameConfiguration>;
  includeThirdPlaceMatch?: boolean;
  generatedAt?: string;
  phaseConfigs?: TournamentPhaseConfigs;
}

export interface GeneratedTournamentStructure {
  phases: TournamentPhase[];
  groups: TournamentGroup[];
  matches: TournamentMatch[];
}

interface FormatDefinition {
  id: TournamentFormatId;
  name: string;
  description: string;
  generate: (options: GenerateTournamentStructureOptions) => GeneratedTournamentStructure;
}

const DEFAULT_GAME_CONFIG: Partial<GameConfiguration> = {
  category: 'Misto',
  modality: 'dupla',
  format: 'melhorDe3',
  pointsPerSet: [21, 21, 15],
  needTwoPointLead: true,
  directWinFormat: false,
  sideSwitchSum: [7, 7, 5],
  hasTechnicalTimeout: false,
  technicalTimeoutSum: 0,
  teamTimeoutsPerSet: 2,
  teamTimeoutDurationSec: 30,
  coinTossMode: 'initialThenAlternate',
  status: 'agendado',
  hasStatistics: true,
};

const PLACEHOLDER_PLAYERS = [
  { name: 'A definir', number: 1 },
  { name: 'A definir', number: 2 },
];

const ensureTwelveTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 12) {
    throw new Error('Os formatos iniciais suportam exatamente 12 duplas inscritas.');
  }
};

const ensureTenTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 10) {
    throw new Error('Este formato suporta exatamente 10 duplas inscritas.');
  }
};

const ensureTwelveTeamsForCross = (teams: TournamentTeam[]) => {
  if (teams.length !== 12) {
    throw new Error('Este formato suporta exatamente 12 duplas inscritas (2 grupos de 6).');
  }
};

const ensureSixTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 6) {
    throw new Error('Este formato suporta exatamente 6 duplas inscritas (2 grupos de 3).');
  }
};

const ensureEightTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 8) {
    throw new Error('Este formato suporta exatamente 8 duplas inscritas (2 grupos de 4).');
  }
};

const ensureNineTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 9) {
    throw new Error('Este formato suporta exatamente 9 duplas inscritas (Grupo A com 5 e Grupo B com 4).');
  }
};

const ensureFiveTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 5) {
    throw new Error('Este formato suporta exatamente 5 equipes inscritas.');
  }
};

const ensureFifteenTeams = (teams: TournamentTeam[]) => {
  if (teams.length !== 15) {
    throw new Error('Este formato suporta exatamente 15 equipes inscritas.');
  }
};

/**
 * Gera jogos cruzados entre dois grupos
 * Cada equipe de um grupo joga contra todas as equipes do outro grupo
 * Para classificação, os jogos serão considerados em ambos os grupos
 */
const generateCrossGroupMatches = (
  options: GenerateTournamentStructureOptions,
  phase: TournamentPhase,
  groupA: TournamentGroup,
  groupB: TournamentGroup,
  teamsBySeed: Map<number, TournamentTeam>,
): TournamentMatch[] => {
  const matches: TournamentMatch[] = [];
  const teamsA = groupA.teamIds.map((teamId) => {
    const team = Array.from(teamsBySeed.values()).find((entry) => entry.id === teamId);
    if (!team) {
      throw new Error(`Equipe não encontrada para o grupo ${groupA.name}`);
    }
    return team;
  });
  const teamsB = groupB.teamIds.map((teamId) => {
    const team = Array.from(teamsBySeed.values()).find((entry) => entry.id === teamId);
    if (!team) {
      throw new Error(`Equipe não encontrada para o grupo ${groupB.name}`);
    }
    return team;
  });

  let round = 1;
  // Cada equipe do grupo A joga contra todas do grupo B
  // Os jogos não têm grupo específico (groupId null) para indicar que são cruzados
  teamsA.forEach((teamA) => {
    teamsB.forEach((teamB) => {
      matches.push(
        createMatch(options, phase, {
          round,
          title: `${groupA.name} vs ${groupB.name} - ${teamA.team.name} x ${teamB.team.name}`,
          teamA: teamA.team,
          teamB: teamB.team,
          teamAId: teamA.id,
          teamBId: teamB.id,
          // Não definir group para jogos cruzados - serão considerados em ambos os grupos na classificação
        }),
      );
      round += 1;
    });
  });

  return matches;
};

const mapTeamsBySeed = (teams: TournamentTeam[]) => new Map(teams.map((entry) => [entry.seed, entry]));

let matchIncrement = 0;

const resetMatchCounter = () => {
  matchIncrement = 0;
};

const nextMatchId = (tournamentId: string, prefix: string) => {
  matchIncrement += 1;
  return `${tournamentId}-${prefix}-${matchIncrement}`;
};

const mergeGameConfig = (base?: Partial<GameConfiguration>): Partial<GameConfiguration> => ({
  ...DEFAULT_GAME_CONFIG,
  ...base,
});

const placeholderTeam = (label: string): Team => ({
  name: label,
  players: PLACEHOLDER_PLAYERS,
});

const createMatch = (
  options: GenerateTournamentStructureOptions,
  phase: TournamentPhase,
  params: {
    round: number;
    title: string;
    teamA: Team;
    teamB: Team;
    teamAId?: string;
    teamBId?: string;
    group?: TournamentGroup;
    tableId?: string;
    scheduledAt?: string;
    customId?: string;
    configType?: TournamentPhaseConfigType;
    configOverride?: Partial<GameConfiguration>;
  },
): TournamentMatch => {
  const inferredConfigType: TournamentPhaseConfigType =
    params.configType ?? (phase.type === 'group' ? 'group' : 'knockout');

  const overrideConfig = params.configOverride ?? options.phaseConfigs?.[inferredConfigType];

  const baseConfig = mergeGameConfig({
    ...options.baseGameConfig,
    ...(overrideConfig ?? {}),
  });
  const createdAt = options.generatedAt ?? new Date().toISOString();
  const id = params.customId ?? nextMatchId(options.tournamentId, phase.id);

  const match: TournamentMatch = {
    id,
    tournamentId: options.tournamentId,
    title: params.title,
    category: baseConfig.category ?? 'Misto',
    modality: baseConfig.modality ?? 'dupla',
    format: baseConfig.format ?? 'melhorDe3',
    teamA: params.teamA,
    teamB: params.teamB,
    pointsPerSet: baseConfig.pointsPerSet ?? [21, 21, 15],
    needTwoPointLead: baseConfig.needTwoPointLead ?? true,
    directWinFormat: baseConfig.directWinFormat ?? false,
    sideSwitchSum: baseConfig.sideSwitchSum ?? [7, 7, 5],
    hasTechnicalTimeout: baseConfig.hasTechnicalTimeout ?? false,
    technicalTimeoutSum: baseConfig.technicalTimeoutSum ?? 0,
    teamTimeoutsPerSet: baseConfig.teamTimeoutsPerSet ?? 2,
    teamTimeoutDurationSec: baseConfig.teamTimeoutDurationSec ?? 30,
    coinTossMode: baseConfig.coinTossMode ?? 'initialThenAlternate',
    notes: baseConfig.notes,
    status: baseConfig.status ?? 'agendado',
    createdAt,
    updatedAt: createdAt,
    hasStatistics: baseConfig.hasStatistics ?? true,
    phaseId: phase.id,
    phaseName: phase.name,
    round: params.round,
    groupId: params.group?.id,
    groupName: params.group?.name,
    tableId: params.tableId,
    scheduledAt: params.scheduledAt,
    teamAId: params.teamAId,
    teamBId: params.teamBId,
  };

  return match;
};

const generateGroupStageMatches = (
  options: GenerateTournamentStructureOptions,
  phase: TournamentPhase,
  groups: TournamentGroup[],
  teamsBySeed: Map<number, TournamentTeam>,
) => {
  const matches: TournamentMatch[] = [];

  groups.forEach((group) => {
    const seeds = group.teamIds.map((teamId) => {
      const team = Array.from(teamsBySeed.values()).find((entry) => entry.id === teamId);
      if (!team) {
        throw new Error(`Equipe não encontrada para o grupo ${group.name}`);
      }
      return team;
    });

    let round = 1;
    for (let i = 0; i < seeds.length; i += 1) {
      for (let j = i + 1; j < seeds.length; j += 1) {
        const teamAEntry = seeds[i];
        const teamBEntry = seeds[j];
        matches.push(
          createMatch(options, phase, {
            round,
            title: `${group.name} - ${teamAEntry.team.name} x ${teamBEntry.team.name}`,
            teamA: teamAEntry.team,
            teamB: teamBEntry.team,
            teamAId: teamAEntry.id,
            teamBId: teamBEntry.id,
            group,
          }),
        );
        round += 1;
      }
    }
  });

  return matches;
};

const formatDefinitions: Record<TournamentFormatId, FormatDefinition> = {
  groups_and_knockout: {
    id: 'groups_and_knockout',
    name: 'Grupos + Eliminatória',
    description:
      'Quatro grupos de três duplas, todos contra todos, com dois melhores avançando para quartas de final, semifinais e final.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-d', name: 'Grupo D', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 8, 9],
        'grupo-b': [2, 7, 10],
        'grupo-c': [3, 6, 11],
        'grupo-d': [4, 5, 12],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      const quarterfinals = [
        {
          title: 'Quartas de final 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('2º Grupo D'),
        },
        {
          title: 'Quartas de final 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Grupo C'),
        },
        {
          title: 'Quartas de final 3',
          teamA: placeholder('1º Grupo C'),
          teamB: placeholder('2º Grupo B'),
        },
        {
          title: 'Quartas de final 4',
          teamA: placeholder('1º Grupo D'),
          teamB: placeholder('2º Grupo A'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = quarterfinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('Vencedor Quartas 1'),
          teamB: placeholder('Vencedor Quartas 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('Vencedor Quartas 3'),
          teamB: placeholder('Vencedor Quartas 4'),
        },
      ];

      knockoutMatches.push(
        ...semifinals.map((match) =>
          createMatch(options, phaseKnockout, {
            round: 2,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 3,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 4,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  double_elimination: {
    id: 'double_elimination',
    name: 'Eliminatória Dupla',
    description: 'Chave com dupla eliminação, incluindo chave de vencedores, repescagem e finais cruzadas.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseWinners: TournamentPhase = {
        id: 'chave-vencedores',
        name: 'Chave de Vencedores',
        order: 1,
        type: 'double_elimination',
      };

      const phaseLosers: TournamentPhase = {
        id: 'chave-repescagem',
        name: 'Repescagem',
        order: 2,
        type: 'double_elimination',
      };

      const phaseFinals: TournamentPhase = {
        id: 'finais',
        name: 'Finais',
        order: 3,
        type: 'double_elimination',
      };

      const winnersMatches: TournamentMatch[] = [];

      const winnersRound1Seeds: Array<[number, number]> = [
        [5, 12],
        [8, 9],
        [6, 11],
        [7, 10],
      ];

      winnersRound1Seeds.forEach(([seedA, seedB]) => {
        const teamA = teamsBySeed.get(seedA);
        const teamB = teamsBySeed.get(seedB);
        if (!teamA || !teamB) {
          throw new Error('Seed inválido na chave de vencedores (primeira rodada).');
        }

        winnersMatches.push(
          createMatch(options, phaseWinners, {
            round: 1,
            title: `Winners R1 - ${teamA.team.name} x ${teamB.team.name}`,
            teamA: teamA.team,
            teamB: teamB.team,
            teamAId: teamA.id,
            teamBId: teamB.id,
          }),
        );
      });

      const seedsWithByes: Array<[number, string]> = [
        [1, 'Vencedor Winners R1-1'],
        [4, 'Vencedor Winners R1-2'],
        [3, 'Vencedor Winners R1-3'],
        [2, 'Vencedor Winners R1-4'],
      ];

      seedsWithByes.forEach(([seed, opponentLabel]) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Seed ${seed} não encontrado para segunda rodada da chave de vencedores.`);
        }

        winnersMatches.push(
          createMatch(options, phaseWinners, {
            round: 2,
            title: `Winners R2 - ${team.team.name} x ${opponentLabel}`,
            teamA: team.team,
            teamB: placeholderTeam(opponentLabel),
            teamAId: team.id,
          }),
        );
      });

      const laterWinnerRounds: Array<{ title: string; round: number }> = [
        { title: 'Winners R3 - Vencedor R2-1 x Vencedor R2-2', round: 3 },
        { title: 'Winners R3 - Vencedor R2-3 x Vencedor R2-4', round: 3 },
        { title: 'Final da Chave de Vencedores', round: 4 },
      ];

      laterWinnerRounds.forEach(({ title, round }) => {
        winnersMatches.push(
          createMatch(options, phaseWinners, {
            round,
            title,
            teamA: placeholderTeam('A definir'),
            teamB: placeholderTeam('A definir'),
          }),
        );
      });

      const losersMatches: TournamentMatch[] = [];

      const repescagemTitulos: string[] = [
        'Repescagem R1 - Perdedor Winners R1-1 x Perdedor Winners R1-2',
        'Repescagem R1 - Perdedor Winners R1-3 x Perdedor Winners R1-4',
        'Repescagem R2 - Perdedor Winners R2-1 x Vencedor Repescagem R1-1',
        'Repescagem R2 - Perdedor Winners R2-2 x Vencedor Repescagem R1-2',
        'Repescagem R3 - Perdedor Winners R2-3 x Vencedor Repescagem R2-1',
        'Repescagem R3 - Perdedor Winners R2-4 x Vencedor Repescagem R2-2',
        'Repescagem R4 - Perdedor Winners R3-1 x Vencedor Repescagem R3-1',
        'Repescagem R4 - Perdedor Winners R3-2 x Vencedor Repescagem R3-2',
        'Final Repescagem - Vencedores Repescagem R4',
      ];

      repescagemTitulos.forEach((title, index) => {
        losersMatches.push(
          createMatch(options, phaseLosers, {
            round: index + 1,
            title,
            teamA: placeholderTeam('A definir'),
            teamB: placeholderTeam('A definir'),
          }),
        );
      });

      const finalsMatches: TournamentMatch[] = [
        createMatch(options, phaseFinals, {
          round: 1,
          title: 'Grande Final',
          teamA: placeholderTeam('Vencedor Chave Vencedores'),
          teamB: placeholderTeam('Vencedor Repescagem'),
        }),
        createMatch(options, phaseFinals, {
          round: 2,
          title: 'Grande Final (Jogo Extra, se necessário)',
          teamA: placeholderTeam('Perdedor Grande Final'),
          teamB: placeholderTeam('Vencedor Grande Final'),
        }),
      ];

      return {
        phases: [phaseWinners, phaseLosers, phaseFinals],
        groups: [],
        matches: [...winnersMatches, ...losersMatches, ...finalsMatches],
      };
    },
  },
  global_semis: {
    id: 'global_semis',
    name: '3 Grupos + Semifinais gerais',
    description:
      'Três grupos com quatro duplas, todos contra todos. Os quatro melhores no geral avançam para as semifinais.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseFinals: TournamentPhase = {
        id: 'fase-finais',
        name: 'Semifinais e Final',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 6, 7, 12],
        'grupo-b': [2, 5, 8, 11],
        'grupo-c': [3, 4, 9, 10],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Seed ${seed} não encontrado`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholderTeam('1º Geral'),
          teamB: placeholderTeam('4º Geral'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholderTeam('2º Geral'),
          teamB: placeholderTeam('3º Geral'),
        },
      ];

      const finalMatches: TournamentMatch[] = [
        ...semifinals.map((match) =>
          createMatch(options, phaseFinals, {
            round: 1,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
        createMatch(options, phaseFinals, {
          round: 2,
          title: 'Final',
          teamA: placeholderTeam('Vencedor Semifinal 1'),
          teamB: placeholderTeam('Vencedor Semifinal 2'),
        }),
      ];

      return {
        phases: [phaseGroup, phaseFinals],
        groups,
        matches: [...groupMatches, ...finalMatches],
      };
    },
  },
  series_gold_silver: {
    id: 'series_gold_silver',
    name: 'Séries Ouro e Prata',
    description:
      'Três grupos com quatro duplas. As duas melhores de cada grupo formam a Série Ouro e as demais disputam a Série Prata, ambas com semifinais e finais.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroups: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseGold: TournamentPhase = {
        id: 'serie-ouro',
        name: 'Série Ouro',
        order: 2,
        type: 'series',
      };

      const phaseSilver: TournamentPhase = {
        id: 'serie-prata',
        name: 'Série Prata',
        order: 3,
        type: 'series',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroups.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroups.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroups.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 6, 7, 12],
        'grupo-b': [2, 5, 8, 11],
        'grupo-c': [3, 4, 9, 10],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Seed ${seed} não encontrado`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroups, groups, teamsBySeed);

      const goldMatches: TournamentMatch[] = [
        createMatch(options, phaseGold, {
          round: 1,
          title: 'Semifinal Ouro 1',
          teamA: placeholderTeam('1º Série Ouro'),
          teamB: placeholderTeam('4º Série Ouro'),
        }),
        createMatch(options, phaseGold, {
          round: 1,
          title: 'Semifinal Ouro 2',
          teamA: placeholderTeam('2º Série Ouro'),
          teamB: placeholderTeam('3º Série Ouro'),
        }),
        createMatch(options, phaseGold, {
          round: 2,
          title: 'Final Ouro',
          teamA: placeholderTeam('Vencedor Semifinal Ouro 1'),
          teamB: placeholderTeam('Vencedor Semifinal Ouro 2'),
        }),
        createMatch(options, phaseGold, {
          round: 2,
          title: 'Disputa Bronze Ouro',
          teamA: placeholderTeam('Perdedor Semifinal Ouro 1'),
          teamB: placeholderTeam('Perdedor Semifinal Ouro 2'),
          configType: 'thirdPlace',
        }),
      ];

      const silverMatches: TournamentMatch[] = [
        createMatch(options, phaseSilver, {
          round: 1,
          title: 'Semifinal Prata 1',
          teamA: placeholderTeam('1º Série Prata'),
          teamB: placeholderTeam('4º Série Prata'),
        }),
        createMatch(options, phaseSilver, {
          round: 1,
          title: 'Semifinal Prata 2',
          teamA: placeholderTeam('2º Série Prata'),
          teamB: placeholderTeam('3º Série Prata'),
        }),
        createMatch(options, phaseSilver, {
          round: 2,
          title: 'Final Prata',
          teamA: placeholderTeam('Vencedor Semifinal Prata 1'),
          teamB: placeholderTeam('Vencedor Semifinal Prata 2'),
        }),
        createMatch(options, phaseSilver, {
          round: 2,
          title: 'Disputa Bronze Prata',
          teamA: placeholderTeam('Perdedor Semifinal Prata 1'),
          teamB: placeholderTeam('Perdedor Semifinal Prata 2'),
          configType: 'thirdPlace',
        }),
      ];

      return {
        phases: [phaseGroups, phaseGold, phaseSilver],
        groups,
        matches: [...groupMatches, ...goldMatches, ...silverMatches],
      };
    },
  },
  single_elimination: {
    id: 'single_elimination',
    name: 'Eliminatória Simples',
    description: 'Chave simples com 12 duplas, contemplando quatro byes para avançar às quartas de final.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phase: TournamentPhase = {
        id: 'eliminatoria-simples',
        name: 'Eliminatória Simples',
        order: 1,
        type: 'knockout',
      };

      const roundOfSixteenMatches: TournamentMatch[] = [];
      const playInPairs: Array<[number, number]> = [
        [5, 12],
        [8, 9],
        [6, 11],
        [7, 10],
      ];

      playInPairs.forEach(([seedA, seedB], index) => {
        const teamA = teamsBySeed.get(seedA);
        const teamB = teamsBySeed.get(seedB);
        if (!teamA || !teamB) {
          throw new Error('Seeds inválidos para eliminatória simples.');
        }

        roundOfSixteenMatches.push(
          createMatch(options, phase, {
            round: 1,
            title: `Primeira Rodada - ${teamA.team.name} x ${teamB.team.name}`,
            teamA: teamA.team,
            teamB: teamB.team,
            teamAId: teamA.id,
            teamBId: teamB.id,
          }),
        );
      });

      const quarterfinalMatches = [
        {
          title: 'Quartas 1',
          seed: 1,
          opponent: 'Vencedor Primeira Rodada 1',
        },
        {
          title: 'Quartas 2',
          seed: 4,
          opponent: 'Vencedor Primeira Rodada 2',
        },
        {
          title: 'Quartas 3',
          seed: 3,
          opponent: 'Vencedor Primeira Rodada 3',
        },
        {
          title: 'Quartas 4',
          seed: 2,
          opponent: 'Vencedor Primeira Rodada 4',
        },
      ] as const;

      const quarterMatches = quarterfinalMatches.map((match) => {
        const team = teamsBySeed.get(match.seed);
        if (!team) {
          throw new Error('Seeds principais não encontrados para quartas de final da eliminatória simples.');
        }

        return createMatch(options, phase, {
          round: 2,
          title: match.title,
          teamA: team.team,
          teamB: placeholderTeam(match.opponent),
          teamAId: team.id,
        });
      });

      const semifinalMatches = [
        createMatch(options, phase, {
          round: 3,
          title: 'Semifinal 1',
          teamA: placeholderTeam('Vencedor Quartas 1'),
          teamB: placeholderTeam('Vencedor Quartas 2'),
        }),
        createMatch(options, phase, {
          round: 3,
          title: 'Semifinal 2',
          teamA: placeholderTeam('Vencedor Quartas 3'),
          teamB: placeholderTeam('Vencedor Quartas 4'),
        }),
      ];

      const finals: TournamentMatch[] = [
        createMatch(options, phase, {
          round: 4,
          title: 'Final',
          teamA: placeholderTeam('Vencedor Semifinal 1'),
          teamB: placeholderTeam('Vencedor Semifinal 2'),
        }),
        createMatch(options, phase, {
          round: 4,
          title: 'Disputa 3º lugar',
          teamA: placeholderTeam('Perdedor Semifinal 1'),
          teamB: placeholderTeam('Perdedor Semifinal 2'),
          configType: 'thirdPlace',
        }),
      ];

      return {
        phases: [phase],
        groups: [],
        matches: [...roundOfSixteenMatches, ...quarterMatches, ...semifinalMatches, ...finals],
      };
    },
  },
  '3_groups_quarterfinals': {
    id: '3_groups_quarterfinals',
    name: '3 Grupos + Quartas com melhores 3º',
    description:
      'Três grupos com quatro duplas, todos contra todos. Classificam 1º e 2º de cada grupo + 2 melhores 3º colocados para as quartas de final.',
    generate: (options) => {
      ensureTwelveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 6, 7, 12],
        'grupo-b': [2, 5, 8, 11],
        'grupo-c': [3, 4, 9, 10],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Seed ${seed} não encontrado`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      const quarterfinals = [
        {
          title: 'Quartas de final 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('Melhor 3º'),
        },
        {
          title: 'Quartas de final 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Grupo C'),
        },
        {
          title: 'Quartas de final 3',
          teamA: placeholder('1º Grupo C'),
          teamB: placeholder('2º Grupo B'),
        },
        {
          title: 'Quartas de final 4',
          teamA: placeholder('2º Grupo A'),
          teamB: placeholder('2º Melhor 3º'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = quarterfinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('Vencedor Quartas 1'),
          teamB: placeholder('Vencedor Quartas 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('Vencedor Quartas 3'),
          teamB: placeholder('Vencedor Quartas 4'),
        },
      ];

      knockoutMatches.push(
        ...semifinals.map((match) =>
          createMatch(options, phaseKnockout, {
            round: 2,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 3,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 4,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_5_quarterfinals': {
    id: '2_groups_5_quarterfinals',
    name: '2 Grupos de 5 + Quartas, Semi e Final',
    description:
      'Dois grupos com cinco duplas cada, todos contra todos. Os quatro melhores de cada grupo avançam para as quartas de final, semifinais e final.',
    generate: (options) => {
      ensureTenTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuição dos seeds: Grupo A (1, 3, 5, 7, 9) e Grupo B (2, 4, 6, 8, 10)
      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 3, 5, 7, 9],
        'grupo-b': [2, 4, 6, 8, 10],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      // Quartas de final: 4 melhores de cada grupo (8 equipes no total)
      const quarterfinals = [
        {
          title: 'Quartas de final 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('4º Grupo B'),
        },
        {
          title: 'Quartas de final 2',
          teamA: placeholder('2º Grupo A'),
          teamB: placeholder('3º Grupo B'),
        },
        {
          title: 'Quartas de final 3',
          teamA: placeholder('3º Grupo A'),
          teamB: placeholder('2º Grupo B'),
        },
        {
          title: 'Quartas de final 4',
          teamA: placeholder('4º Grupo A'),
          teamB: placeholder('1º Grupo B'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = quarterfinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('Vencedor Quartas 1'),
          teamB: placeholder('Vencedor Quartas 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('Vencedor Quartas 3'),
          teamB: placeholder('Vencedor Quartas 4'),
        },
      ];

      knockoutMatches.push(
        ...semifinals.map((match) =>
          createMatch(options, phaseKnockout, {
            round: 2,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 3,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 4,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_6_cross_semis': {
    id: '2_groups_6_cross_semis',
    name: '2 Grupos de 6 - Cruzado + Semi/Final',
    description:
      'Dois grupos de seis duplas cada. Cada dupla de um grupo joga contra todas as duplas do outro grupo. Após a fase de grupos, escolha os 4 semi-finalistas para semifinais, final e disputa de 3º lugar.',
    generate: (options) => {
      ensureTwelveTeamsForCross(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuir seeds: Grupo A (1,3,5,7,9,11) e Grupo B (2,4,6,8,10,12)
      const groupASeeds = [1, 3, 5, 7, 9, 11];
      const groupBSeeds = [2, 4, 6, 8, 10, 12];

      groups[0].teamIds = groupASeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      groups[1].teamIds = groupBSeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar jogos cruzados: cada dupla do grupo A joga contra todas do grupo B
      const crossMatches = generateCrossGroupMatches(
        options,
        phaseGroup,
        groups[0],
        groups[1],
        teamsBySeed,
      );

      // Criar placeholders para semifinais (serão definidos manualmente)
      const placeholder = placeholderTeam;
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('A definir'),
          teamB: placeholder('A definir'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('A definir'),
          teamB: placeholder('A definir'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      // Disputa de 3º lugar
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 2,
          title: 'Decisão 3º lugar',
          teamA: placeholder('Perdedor Semifinal 1'),
          teamB: placeholder('Perdedor Semifinal 2'),
          configType: 'thirdPlace',
        }),
      );

      // Final
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...crossMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_3_cross_semis': {
    id: '2_groups_3_cross_semis',
    name: '2 Grupos de 3 - Cruzado + Semi/Final',
    description:
      'Dois grupos de três duplas cada. Cada dupla de um grupo joga contra todas as duplas do outro grupo. Os 2 melhores de cada grupo avançam para semifinais (1º A × 2º A e 1º B × 2º B), depois 3º lugar e final.',
    generate: (options) => {
      ensureSixTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuir seeds: Grupo A (1, 3, 5) e Grupo B (2, 4, 6)
      const groupASeeds = [1, 3, 5];
      const groupBSeeds = [2, 4, 6];

      groups[0].teamIds = groupASeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      groups[1].teamIds = groupBSeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar jogos cruzados: cada dupla do grupo A joga contra todas do grupo B
      const crossMatches = generateCrossGroupMatches(
        options,
        phaseGroup,
        groups[0],
        groups[1],
        teamsBySeed,
      );

      // Criar placeholders para semifinais (serão definidos manualmente)
      const placeholder = placeholderTeam;
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('2º Grupo A'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Grupo B'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      // Disputa de 3º lugar
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 2,
          title: 'Decisão 3º lugar',
          teamA: placeholder('Perdedor Semifinal 1'),
          teamB: placeholder('Perdedor Semifinal 2'),
          configType: 'thirdPlace',
        }),
      );

      // Final
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...crossMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_3_repescagem_semis': {
    id: '2_groups_3_repescagem_semis',
    name: '2 Grupos de 3 - Repescagem + Semi/Final',
    description:
      'Dois grupos de três duplas cada. Todos contra todos dentro do grupo. O 1º de cada grupo vai direto para semifinal. Os 2º e 3º fazem repescagem cruzada (2º A × 3º B e 2º B × 3º A). Vencedores das repescagens avançam para semifinais.',
    generate: (options) => {
      ensureSixTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseRepechage: TournamentPhase = {
        id: 'fase-repescagem',
        name: 'Repescagem',
        order: 2,
        type: 'knockout',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 3,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuir seeds: Grupo A (1, 3, 5) e Grupo B (2, 4, 6)
      const groupASeeds = [1, 3, 5];
      const groupBSeeds = [2, 4, 6];

      groups[0].teamIds = groupASeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      groups[1].teamIds = groupBSeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar jogos dentro dos grupos (todos contra todos)
      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      // Criar placeholders para repescagem
      const placeholder = placeholderTeam;
      const repechageMatches = [
        {
          title: 'Repescagem 1',
          teamA: placeholder('2º Grupo A'),
          teamB: placeholder('3º Grupo B'),
        },
        {
          title: 'Repescagem 2',
          teamA: placeholder('2º Grupo B'),
          teamB: placeholder('3º Grupo A'),
        },
      ];

      const repechageMatchesList: TournamentMatch[] = repechageMatches.map((match) =>
        createMatch(options, phaseRepechage, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
          configType: 'quarterfinals',
        }),
      );

      // Criar placeholders para semifinais
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('Vencedor Repescagem 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('Vencedor Repescagem 1'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      // Disputa de 3º lugar
      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 2,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      // Final
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseRepechage, phaseKnockout],
        groups,
        matches: [...groupMatches, ...repechageMatchesList, ...knockoutMatches],
      };
    },
  },
  '6_teams_round_robin': {
    id: '6_teams_round_robin',
    name: '6 Duplas - Todos contra Todos + Final',
    description:
      'Seis duplas em um único grupo. Todos jogam contra todos (15 jogos). Após a fase de grupos, os 2 primeiros disputam a final e os 3º e 4º colocados disputam o 3º lugar (opcional).',
    generate: (options) => {
      ensureSixTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseFinals: TournamentPhase = {
        id: 'fase-finais',
        name: 'Finais',
        order: 2,
        type: 'knockout',
      };

      // Todas as 6 duplas em um único grupo
      const groups: TournamentGroup[] = [
        { id: 'grupo-único', name: 'Grupo Único', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Adicionar todas as 6 duplas ao grupo único
      groups[0].teamIds = [1, 2, 3, 4, 5, 6].map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar todos os jogos do round-robin (todos contra todos)
      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      // Criar placeholders para as finais
      const placeholder = placeholderTeam;
      const finalMatches: TournamentMatch[] = [];

      // Final: 1º vs 2º
      finalMatches.push(
        createMatch(options, phaseFinals, {
          round: 1,
          title: 'Final',
          teamA: placeholder('1º Colocado'),
          teamB: placeholder('2º Colocado'),
        }),
      );

      // Disputa de 3º lugar (opcional)
      if (options.includeThirdPlaceMatch) {
        finalMatches.push(
          createMatch(options, phaseFinals, {
            round: 1,
            title: 'Disputa 3º lugar',
            teamA: placeholder('3º Colocado'),
            teamB: placeholder('4º Colocado'),
            configType: 'thirdPlace',
          }),
        );
      }

      return {
        phases: [phaseGroup, phaseFinals],
        groups,
        matches: [...groupMatches, ...finalMatches],
      };
    },
  },
  '5_teams_round_robin': {
    id: '5_teams_round_robin',
    name: '5 Duplas - Todos contra Todos + Final',
    description:
      'Cinco duplas em um único grupo. Todos jogam contra todos (10 jogos). Após a fase de grupos, os 2 primeiros disputam a final e os 3º e 4º colocados disputam o 3º lugar (opcional).',
    generate: (options) => {
      ensureFiveTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseFinals: TournamentPhase = {
        id: 'fase-finais',
        name: 'Finais',
        order: 2,
        type: 'knockout',
      };

      // Todas as 5 duplas em um único grupo
      const groups: TournamentGroup[] = [
        { id: 'grupo-único', name: 'Grupo Único', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Adicionar todas as 5 duplas ao grupo único
      groups[0].teamIds = [1, 2, 3, 4, 5].map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar todos os jogos do round-robin (todos contra todos)
      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      // Criar placeholders para as finais
      const placeholder = placeholderTeam;
      const finalMatches: TournamentMatch[] = [];

      // Final: 1º vs 2º
      finalMatches.push(
        createMatch(options, phaseFinals, {
          round: 1,
          title: 'Final',
          teamA: placeholder('1º Colocado'),
          teamB: placeholder('2º Colocado'),
        }),
      );

      // Disputa de 3º lugar (opcional)
      if (options.includeThirdPlaceMatch) {
        finalMatches.push(
          createMatch(options, phaseFinals, {
            round: 1,
            title: 'Disputa 3º lugar',
            teamA: placeholder('3º Colocado'),
            teamB: placeholder('4º Colocado'),
            configType: 'thirdPlace',
          }),
        );
      }

      return {
        phases: [phaseGroup, phaseFinals],
        groups,
        matches: [...groupMatches, ...finalMatches],
      };
    },
  },
  '3_groups_3_semis': {
    id: '3_groups_3_semis',
    name: '3 Grupos de 3 - Semifinal',
    description:
      'Três grupos com 3 equipes cada. Todos contra todos em cada grupo. Classificam os 3 primeiros colocados de cada grupo + o melhor 2º colocado (4 equipes) para semifinais e final.',
    generate: (options) => {
      ensureNineTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 4, 7],
        'grupo-b': [2, 5, 8],
        'grupo-c': [3, 6, 9],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Não foi possível encontrar a equipe com seed ${seed}`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('Melhor 2º'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('1º Grupo C'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 2,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '3_groups_3_quarterfinals': {
    id: '3_groups_3_quarterfinals',
    name: '3 Grupos de 3 - Quartas de Final',
    description:
      'Três grupos com 3 equipes cada. Todos contra todos em cada grupo. Classificam 8 equipes (3 primeiros + 5 melhores 2º) para quartas de final, semifinais e final.',
    generate: (options) => {
      ensureNineTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 4, 7],
        'grupo-b': [2, 5, 8],
        'grupo-c': [3, 6, 9],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Não foi possível encontrar a equipe com seed ${seed}`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      const quarterfinals = [
        {
          title: 'Quartas de final 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('Melhor 2º'),
        },
        {
          title: 'Quartas de final 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Melhor 2º'),
        },
        {
          title: 'Quartas de final 3',
          teamA: placeholder('1º Grupo C'),
          teamB: placeholder('3º Melhor 2º'),
        },
        {
          title: 'Quartas de final 4',
          teamA: placeholder('2º Grupo A'),
          teamB: placeholder('4º Melhor 2º'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = quarterfinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('Vencedor Quartas 1'),
          teamB: placeholder('Vencedor Quartas 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('Vencedor Quartas 3'),
          teamB: placeholder('Vencedor Quartas 4'),
        },
      ];

      knockoutMatches.push(
        ...semifinals.map((match) =>
          createMatch(options, phaseKnockout, {
            round: 2,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 3,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 4,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '5_groups_3_quarterfinals': {
    id: '5_groups_3_quarterfinals',
    name: '5 Grupos de 3 - Quartas de Final',
    description:
      'Cinco grupos com 3 equipes cada. Todos contra todos em cada grupo. Classificam 8 equipes (5 primeiros + 3 melhores 2º) para quartas de final, semifinais e final.',
    generate: (options) => {
      ensureFifteenTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Eliminatórias',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-c', name: 'Grupo C', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-d', name: 'Grupo D', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-e', name: 'Grupo E', phaseId: phaseGroup.id, teamIds: [] },
      ];

      const groupSeeds: Record<string, number[]> = {
        'grupo-a': [1, 6, 11],
        'grupo-b': [2, 7, 12],
        'grupo-c': [3, 8, 13],
        'grupo-d': [4, 9, 14],
        'grupo-e': [5, 10, 15],
      };

      groups.forEach((group) => {
        group.teamIds = groupSeeds[group.id].map((seed) => {
          const team = teamsBySeed.get(seed);
          if (!team) {
            throw new Error(`Não foi possível encontrar a equipe com seed ${seed}`);
          }
          return team.id;
        });
      });

      const groupMatches = generateGroupStageMatches(options, phaseGroup, groups, teamsBySeed);

      const placeholder = placeholderTeam;
      const quarterfinals = [
        {
          title: 'Quartas de final 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('Melhor 2º'),
        },
        {
          title: 'Quartas de final 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Melhor 2º'),
        },
        {
          title: 'Quartas de final 3',
          teamA: placeholder('1º Grupo C'),
          teamB: placeholder('3º Melhor 2º'),
        },
        {
          title: 'Quartas de final 4',
          teamA: placeholder('1º Grupo D'),
          teamB: placeholder('1º Grupo E'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = quarterfinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('Vencedor Quartas 1'),
          teamB: placeholder('Vencedor Quartas 2'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('Vencedor Quartas 3'),
          teamB: placeholder('Vencedor Quartas 4'),
        },
      ];

      knockoutMatches.push(
        ...semifinals.map((match) =>
          createMatch(options, phaseKnockout, {
            round: 2,
            title: match.title,
            teamA: match.teamA,
            teamB: match.teamB,
          }),
        ),
      );

      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 3,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 4,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_4_semis': {
    id: '2_groups_4_semis',
    name: '2 Grupos de 4 - Semi/Final',
    description:
      'Dois grupos de quatro duplas cada. Todos contra todos dentro de cada grupo. Os 2 primeiros colocados de cada grupo avançam para semifinais (1º A × 2º B, 1º B × 2º A), depois 3º lugar e final.',
    generate: (options) => {
      ensureEightTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Semifinal',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuir seeds: Grupo A (1, 3, 5, 7) e Grupo B (2, 4, 6, 8)
      const groupASeeds = [1, 3, 5, 7];
      const groupBSeeds = [2, 4, 6, 8];

      groups[0].teamIds = groupASeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      groups[1].teamIds = groupBSeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar jogos dentro de cada grupo (todos contra todos)
      const groupMatches = generateGroupStageMatches(
        options,
        phaseGroup,
        groups,
        teamsBySeed,
      );

      // Criar placeholders para semifinais (serão definidos manualmente)
      const placeholder = placeholderTeam;
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('2º Grupo B'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Grupo A'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      // Disputa de 3º lugar
      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 2,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      // Final
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
  '2_groups_5_4_semis': {
    id: '2_groups_5_4_semis',
    name: '2 Grupos (5+4) - Semi/Final',
    description:
      'Dois grupos: Grupo A com 5 duplas e Grupo B com 4 duplas. Todos contra todos dentro de cada grupo. Os 2 primeiros colocados de cada grupo avançam para semifinais (1º A × 2º B, 1º B × 2º A), depois 3º lugar e final.',
    generate: (options) => {
      ensureNineTeams(options.teams);
      resetMatchCounter();
      const teamsBySeed = mapTeamsBySeed(options.teams);

      const phaseGroup: TournamentPhase = {
        id: 'fase-grupos',
        name: 'Fase de Grupos',
        order: 1,
        type: 'group',
      };

      const phaseKnockout: TournamentPhase = {
        id: 'fase-eliminatoria',
        name: 'Semifinal',
        order: 2,
        type: 'knockout',
      };

      const groups: TournamentGroup[] = [
        { id: 'grupo-a', name: 'Grupo A', phaseId: phaseGroup.id, teamIds: [] },
        { id: 'grupo-b', name: 'Grupo B', phaseId: phaseGroup.id, teamIds: [] },
      ];

      // Distribuir seeds: Grupo A (1, 3, 5, 7, 9) e Grupo B (2, 4, 6, 8)
      const groupASeeds = [1, 3, 5, 7, 9];
      const groupBSeeds = [2, 4, 6, 8];

      groups[0].teamIds = groupASeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      groups[1].teamIds = groupBSeeds.map((seed) => {
        const team = teamsBySeed.get(seed);
        if (!team) {
          throw new Error(`Não foi possível encontrar a dupla com seed ${seed}`);
        }
        return team.id;
      });

      // Gerar jogos dentro de cada grupo (todos contra todos)
      const groupMatches = generateGroupStageMatches(
        options,
        phaseGroup,
        groups,
        teamsBySeed,
      );

      // Criar placeholders para semifinais (serão definidos manualmente)
      const placeholder = placeholderTeam;
      const semifinals = [
        {
          title: 'Semifinal 1',
          teamA: placeholder('1º Grupo A'),
          teamB: placeholder('2º Grupo B'),
        },
        {
          title: 'Semifinal 2',
          teamA: placeholder('1º Grupo B'),
          teamB: placeholder('2º Grupo A'),
        },
      ];

      const knockoutMatches: TournamentMatch[] = semifinals.map((match) =>
        createMatch(options, phaseKnockout, {
          round: 1,
          title: match.title,
          teamA: match.teamA,
          teamB: match.teamB,
        }),
      );

      // Disputa de 3º lugar
      if (options.includeThirdPlaceMatch) {
        knockoutMatches.push(
          createMatch(options, phaseKnockout, {
            round: 2,
            title: 'Decisão 3º lugar',
            teamA: placeholder('Perdedor Semifinal 1'),
            teamB: placeholder('Perdedor Semifinal 2'),
            configType: 'thirdPlace',
          }),
        );
      }

      // Final
      knockoutMatches.push(
        createMatch(options, phaseKnockout, {
          round: 3,
          title: 'Final',
          teamA: placeholder('Vencedor Semifinal 1'),
          teamB: placeholder('Vencedor Semifinal 2'),
        }),
      );

      return {
        phases: [phaseGroup, phaseKnockout],
        groups,
        matches: [...groupMatches, ...knockoutMatches],
      };
    },
  },
};

export const availableTournamentFormats = formatDefinitions;

export const defaultTieBreakerOrder: TieBreakerCriterion[] = [
  'head_to_head',
  'sets_average_inner',
  'points_average_inner',
  'sets_average_global',
  'points_average_global',
  'random_draw',
];

export const generateTournamentStructure = (
  options: GenerateTournamentStructureOptions,
): GeneratedTournamentStructure => {
  const definition = formatDefinitions[options.formatId];
  if (!definition) {
    throw new Error(`Formato ${options.formatId} não suportado.`);
  }
  return definition.generate(options);
};
