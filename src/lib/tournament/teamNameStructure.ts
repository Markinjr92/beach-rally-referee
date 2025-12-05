import { TournamentFormatId } from '@/types/volleyball';

export type TeamNameStructure =
  | { type: 'groups'; groups: Array<{ name: string; id: string; teams: Array<{ seed: number; label: string }> }> }
  | { type: 'seeds'; teams: Array<{ seed: number; label: string }> };

/**
 * Retorna a estrutura de equipes necessária para coletar nomes baseada no formato do torneio
 */
export function getTeamNameStructure(formatId: TournamentFormatId, teamCount: number): TeamNameStructure {
  switch (formatId) {
    case 'groups_and_knockout':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 8, label: 'Equipe 2 do Grupo A' },
              { seed: 9, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 7, label: 'Equipe 2 do Grupo B' },
              { seed: 10, label: 'Equipe 3 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 6, label: 'Equipe 2 do Grupo C' },
              { seed: 11, label: 'Equipe 3 do Grupo C' },
            ],
          },
          {
            name: 'Grupo D',
            id: 'grupo-d',
            teams: [
              { seed: 4, label: 'Equipe 1 do Grupo D' },
              { seed: 5, label: 'Equipe 2 do Grupo D' },
              { seed: 12, label: 'Equipe 3 do Grupo D' },
            ],
          },
        ],
      };

    case 'global_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 6, label: 'Equipe 2 do Grupo A' },
              { seed: 7, label: 'Equipe 3 do Grupo A' },
              { seed: 12, label: 'Equipe 4 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 5, label: 'Equipe 2 do Grupo B' },
              { seed: 8, label: 'Equipe 3 do Grupo B' },
              { seed: 11, label: 'Equipe 4 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 4, label: 'Equipe 2 do Grupo C' },
              { seed: 9, label: 'Equipe 3 do Grupo C' },
              { seed: 10, label: 'Equipe 4 do Grupo C' },
            ],
          },
        ],
      };

    case '3_groups_quarterfinals':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 6, label: 'Equipe 2 do Grupo A' },
              { seed: 7, label: 'Equipe 3 do Grupo A' },
              { seed: 12, label: 'Equipe 4 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 5, label: 'Equipe 2 do Grupo B' },
              { seed: 8, label: 'Equipe 3 do Grupo B' },
              { seed: 11, label: 'Equipe 4 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 4, label: 'Equipe 2 do Grupo C' },
              { seed: 9, label: 'Equipe 3 do Grupo C' },
              { seed: 10, label: 'Equipe 4 do Grupo C' },
            ],
          },
        ],
      };

    case '2_groups_5_quarterfinals':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
              { seed: 7, label: 'Equipe 4 do Grupo A' },
              { seed: 9, label: 'Equipe 5 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
              { seed: 8, label: 'Equipe 4 do Grupo B' },
              { seed: 10, label: 'Equipe 5 do Grupo B' },
            ],
          },
        ],
      };

    case '2_groups_6_cross_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
              { seed: 7, label: 'Equipe 4 do Grupo A' },
              { seed: 9, label: 'Equipe 5 do Grupo A' },
              { seed: 11, label: 'Equipe 6 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
              { seed: 8, label: 'Equipe 4 do Grupo B' },
              { seed: 10, label: 'Equipe 5 do Grupo B' },
              { seed: 12, label: 'Equipe 6 do Grupo B' },
            ],
          },
        ],
      };

    case '2_groups_3_cross_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
            ],
          },
        ],
      };

    case '2_groups_3_repescagem_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
            ],
          },
        ],
      };

    case '2_groups_4_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
              { seed: 7, label: 'Equipe 4 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
              { seed: 8, label: 'Equipe 4 do Grupo B' },
            ],
          },
        ],
      };

    case '2_groups_5_4_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 3, label: 'Equipe 2 do Grupo A' },
              { seed: 5, label: 'Equipe 3 do Grupo A' },
              { seed: 7, label: 'Equipe 4 do Grupo A' },
              { seed: 9, label: 'Equipe 5 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 4, label: 'Equipe 2 do Grupo B' },
              { seed: 6, label: 'Equipe 3 do Grupo B' },
              { seed: 8, label: 'Equipe 4 do Grupo B' },
            ],
          },
        ],
      };

    case '6_teams_round_robin':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo Único',
            id: 'grupo-único',
            teams: [
              { seed: 1, label: 'Equipe 1' },
              { seed: 2, label: 'Equipe 2' },
              { seed: 3, label: 'Equipe 3' },
              { seed: 4, label: 'Equipe 4' },
              { seed: 5, label: 'Equipe 5' },
              { seed: 6, label: 'Equipe 6' },
            ],
          },
        ],
      };

    case '5_teams_round_robin':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo Único',
            id: 'grupo-único',
            teams: [
              { seed: 1, label: 'Equipe 1' },
              { seed: 2, label: 'Equipe 2' },
              { seed: 3, label: 'Equipe 3' },
              { seed: 4, label: 'Equipe 4' },
              { seed: 5, label: 'Equipe 5' },
            ],
          },
        ],
      };

    case '3_groups_3_semis':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 4, label: 'Equipe 2 do Grupo A' },
              { seed: 7, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 5, label: 'Equipe 2 do Grupo B' },
              { seed: 8, label: 'Equipe 3 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 6, label: 'Equipe 2 do Grupo C' },
              { seed: 9, label: 'Equipe 3 do Grupo C' },
            ],
          },
        ],
      };

    case '3_groups_3_quarterfinals':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 4, label: 'Equipe 2 do Grupo A' },
              { seed: 7, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 5, label: 'Equipe 2 do Grupo B' },
              { seed: 8, label: 'Equipe 3 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 6, label: 'Equipe 2 do Grupo C' },
              { seed: 9, label: 'Equipe 3 do Grupo C' },
            ],
          },
        ],
      };

    case '5_groups_3_quarterfinals':
      return {
        type: 'groups',
        groups: [
          {
            name: 'Grupo A',
            id: 'grupo-a',
            teams: [
              { seed: 1, label: 'Equipe 1 do Grupo A' },
              { seed: 6, label: 'Equipe 2 do Grupo A' },
              { seed: 11, label: 'Equipe 3 do Grupo A' },
            ],
          },
          {
            name: 'Grupo B',
            id: 'grupo-b',
            teams: [
              { seed: 2, label: 'Equipe 1 do Grupo B' },
              { seed: 7, label: 'Equipe 2 do Grupo B' },
              { seed: 12, label: 'Equipe 3 do Grupo B' },
            ],
          },
          {
            name: 'Grupo C',
            id: 'grupo-c',
            teams: [
              { seed: 3, label: 'Equipe 1 do Grupo C' },
              { seed: 8, label: 'Equipe 2 do Grupo C' },
              { seed: 13, label: 'Equipe 3 do Grupo C' },
            ],
          },
          {
            name: 'Grupo D',
            id: 'grupo-d',
            teams: [
              { seed: 4, label: 'Equipe 1 do Grupo D' },
              { seed: 9, label: 'Equipe 2 do Grupo D' },
              { seed: 14, label: 'Equipe 3 do Grupo D' },
            ],
          },
          {
            name: 'Grupo E',
            id: 'grupo-e',
            teams: [
              { seed: 5, label: 'Equipe 1 do Grupo E' },
              { seed: 10, label: 'Equipe 2 do Grupo E' },
              { seed: 15, label: 'Equipe 3 do Grupo E' },
            ],
          },
        ],
      };

    case 'single_elimination':
    case 'double_elimination':
    case 'series_gold_silver':
      // Formatos sem grupos - usar ordem sequencial de seeds
      return {
        type: 'seeds',
        teams: Array.from({ length: teamCount }, (_, index) => ({
          seed: index + 1,
          label: `Equipe ${index + 1}`,
        })),
      };

    default:
      // Fallback para formatos não mapeados - usar ordem sequencial
      return {
        type: 'seeds',
        teams: Array.from({ length: teamCount }, (_, index) => ({
          seed: index + 1,
          label: `Equipe ${index + 1}`,
        })),
      };
  }
}

