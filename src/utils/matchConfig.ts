/**
 * Utilitários para configuração de partidas de vôlei
 */

export type MatchFormatPreset = {
  label: string;
  bestOf: 1 | 3;
  pointsPerSet: number[];
  sideSwitchSum: number[];
};

/**
 * Calcula o side_switch_sum correto baseado nos pontos por set
 * Sets de 21 pontos → múltiplo de 7
 * Sets de 15 pontos → múltiplo de 5
 * Sets de 10 pontos ou menos → múltiplo de 5
 */
export const calculateSideSwitchSum = (pointsPerSet: number[]): number[] => {
  return pointsPerSet.map((points) => {
    if (points >= 21) {
      return 7;
    }
    // Para sets de 15 pontos ou menos, usar múltiplo de 5
    return 5;
  });
};

/**
 * Presets de configuração de partidas
 */
export const MATCH_FORMAT_PRESETS = {
  best3_21_15: {
    label: 'Melhor de 3 sets (21/21/15)',
    bestOf: 3,
    pointsPerSet: [21, 21, 15],
    sideSwitchSum: [7, 7, 5],
  },
  best3_15_15: {
    label: 'Melhor de 3 sets (15/15/15)',
    bestOf: 3,
    pointsPerSet: [15, 15, 15],
    sideSwitchSum: [5, 5, 5],
  },
  best3_15_10: {
    label: 'Melhor de 3 sets (15/15/10)',
    bestOf: 3,
    pointsPerSet: [15, 15, 10],
    sideSwitchSum: [5, 5, 5],
  },
  single_21: {
    label: 'Set único de 21 pontos',
    bestOf: 1,
    pointsPerSet: [21],
    sideSwitchSum: [7],
  },
} as const satisfies Record<string, MatchFormatPreset>;

export type MatchFormatPresetKey = keyof typeof MATCH_FORMAT_PRESETS;

/**
 * Converte o formato do torneio para o preset correspondente
 */
export const formatToPreset = (format: string | null | undefined): MatchFormatPresetKey => {
  switch (format) {
    case 'melhorDe3':
      return 'best3_21_15';
    case 'melhorDe3_15':
      return 'best3_15_15';
    case 'melhorDe3_15_10':
      return 'best3_15_10';
    case 'melhorDe1':
      return 'single_21';
    default:
      return 'best3_21_15';
  }
};

/**
 * Obtém a configuração de partida baseado no formato do torneio
 */
export const getMatchConfigFromFormat = (
  format: string | null | undefined
): Pick<MatchFormatPreset, 'bestOf' | 'pointsPerSet' | 'sideSwitchSum'> => {
  const presetKey = formatToPreset(format);
  const preset = MATCH_FORMAT_PRESETS[presetKey];
  return {
    bestOf: preset.bestOf,
    pointsPerSet: [...preset.pointsPerSet],
    sideSwitchSum: [...preset.sideSwitchSum],
  };
};
