import { TournamentFormatId } from '@/types/volleyball';

/**
 * Retorna os formatos de torneio disponíveis para uma quantidade específica de equipes
 */
export const getFormatsByTeamCount = (teamCount: number): TournamentFormatId[] => {
  const formatMap: Record<number, TournamentFormatId[]> = {
    4: ['4_teams_round_robin'],
    5: ['5_teams_round_robin'],
    6: ['2_groups_3_cross_semis', '2_groups_3_repescagem_semis', '6_teams_round_robin'],
    8: ['2_groups_4_semis'],
    9: ['2_groups_5_4_semis', '3_groups_3_semis', '3_groups_3_quarterfinals'],
    10: ['2_groups_5_quarterfinals'],
    12: [
      'groups_and_knockout',
      'double_elimination',
      'global_semis',
      'series_gold_silver',
      'single_elimination',
      '3_groups_quarterfinals',
      '2_groups_6_cross_semis',
    ],
    15: ['5_groups_3_quarterfinals'],
  };
  return formatMap[teamCount] || [];
};

/**
 * Retorna todas as quantidades de equipes suportadas pelos formatos
 */
export const getSupportedTeamCounts = (): number[] => {
  return [4, 5, 6, 8, 9, 10, 12, 15];
};

