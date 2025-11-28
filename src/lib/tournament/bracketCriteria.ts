import { TournamentFormatId } from '@/types/volleyball'
import { normalizePhaseName } from './phaseConfig'

export type BracketMatchDescriptor = {
  label: string
  description: string
  phaseOverride?: string
}

export type BracketSection = {
  phase: string
  matches: BracketMatchDescriptor[]
}

export type BracketCriteria = {
  title: string
  sections: BracketSection[]
}

const match = (label: string, description: string, phaseOverride?: string): BracketMatchDescriptor => ({
  label,
  description,
  phaseOverride,
})

export const bracketCriteriaByFormat: Record<TournamentFormatId, BracketCriteria> = {
  groups_and_knockout: {
    title: 'Grupos + Eliminatória (4 grupos de 3)',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '4 grupos com 3 duplas cada'),
          match('Formato', 'Todos contra todos em cada grupo (3 jogos por grupo)'),
          match('Total', '12 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Quartas de Final',
        matches: [
          match('QF1', '1º Grupo A × 2º Grupo D'),
          match('QF2', '1º Grupo B × 2º Grupo C'),
          match('QF3', '1º Grupo C × 2º Grupo B'),
          match('QF4', '1º Grupo D × 2º Grupo A'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '3_groups_quarterfinals': {
    title: '3 Grupos + Quartas com melhores 3º',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '3 grupos com 4 duplas cada'),
          match('Formato', 'Todos contra todos em cada grupo (6 jogos por grupo)'),
          match('Total', '18 jogos na fase de grupos'),
          match('Ordem', 'A1×A2, A3×A4, A1×A3, A2×A4, A1×A4, A2×A3'),
        ],
      },
      {
        phase: 'Classificação para Quartas',
        matches: [
          match('Classificação', 'Avançam 1º e 2º de cada grupo (6 duplas)'),
          match('Melhores terceiros', '+ 2 melhores 3º colocados'),
          match('Total', '8 duplas nas quartas de final'),
        ],
      },
      {
        phase: 'Quartas de Final',
        matches: [
          match('QF1', '1º Grupo A × Melhor 3º'),
          match('QF2', '1º Grupo B × 2º Grupo C'),
          match('QF3', '1º Grupo C × 2º Grupo B'),
          match('QF4', '2º Grupo A × 2º Melhor 3º'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  global_semis: {
    title: '3 Grupos + Semifinais Gerais',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '3 grupos com 4 duplas cada'),
          match('Formato', 'Todos contra todos em cada grupo (6 jogos por grupo)'),
          match('Total', '18 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Classificação Geral',
        matches: [
          match('Ranking geral', 'Todas as duplas dos 3 grupos ranqueadas em conjunto'),
          match('Avanço', 'Classificam os 4 melhores do ranking geral'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', '1º Geral × 4º Geral'),
          match('SF2', '2º Geral × 3º Geral'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  series_gold_silver: {
    title: 'Séries Ouro e Prata',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '3 grupos com 4 duplas cada'),
          match('Formato', 'Todos contra todos em cada grupo (6 jogos por grupo)'),
          match('Total', '18 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Classificação',
        matches: [
          match('Série Ouro', '2 melhores de cada grupo (6 duplas)'),
          match('Série Prata', 'Demais duplas (6 duplas)'),
        ],
      },
      {
        phase: 'Série Ouro',
        matches: [
          match('SF Ouro 1', '1º Ouro × 4º Ouro'),
          match('SF Ouro 2', '2º Ouro × 3º Ouro'),
          match('Final Ouro', 'Vencedores das semifinais ouro', 'Final Ouro'),
          match('3º lugar Ouro', 'Perdedores das semifinais ouro', 'Disputa 3º lugar Ouro'),
        ],
      },
      {
        phase: 'Série Prata',
        matches: [
          match('SF Prata 1', '1º Prata × 4º Prata'),
          match('SF Prata 2', '2º Prata × 3º Prata'),
          match('Final Prata', 'Vencedores das semifinais prata', 'Final Prata'),
          match('3º lugar Prata', 'Perdedores das semifinais prata', 'Disputa 3º lugar Prata'),
        ],
      },
    ],
  },
  single_elimination: {
    title: 'Eliminatória Simples',
    sections: [
      {
        phase: 'Primeira Rodada',
        matches: [
          match('R1-1', 'Seed 5 × Seed 12'),
          match('R1-2', 'Seed 8 × Seed 9'),
          match('R1-3', 'Seed 6 × Seed 11'),
          match('R1-4', 'Seed 7 × Seed 10'),
        ],
      },
      {
        phase: 'Quartas de Final',
        matches: [
          match('QF1', 'Seed 1 × Venc. R1-1'),
          match('QF2', 'Seed 4 × Venc. R1-2'),
          match('QF3', 'Seed 3 × Venc. R1-3'),
          match('QF4', 'Seed 2 × Venc. R1-4'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  double_elimination: {
    title: 'Eliminatória Dupla',
    sections: [
      {
        phase: 'Chave de Vencedores - R1',
        matches: [
          match('WR1-1', 'Seed 5 × Seed 12'),
          match('WR1-2', 'Seed 8 × Seed 9'),
          match('WR1-3', 'Seed 6 × Seed 11'),
          match('WR1-4', 'Seed 7 × Seed 10'),
        ],
      },
      {
        phase: 'Chave de Vencedores - R2',
        matches: [
          match('WR2-1', 'Seed 1 × Venc. WR1-1'),
          match('WR2-2', 'Seed 4 × Venc. WR1-2'),
          match('WR2-3', 'Seed 3 × Venc. WR1-3'),
          match('WR2-4', 'Seed 2 × Venc. WR1-4'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. WR2-1 × Venc. WR2-2'),
          match('SF2', 'Venc. WR2-3 × Venc. WR2-4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Grande Final', 'Campeão chave vencedores × Campeão chave perdedores', 'Final'),
          match('Repescagem', 'Final extra caso o campeão da chave vencedores perca', 'Final'),
        ],
      },
    ],
  },
  '2_groups_5_quarterfinals': {
    title: '2 Grupos de 5 + Quartas, Semi e Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '2 grupos com 5 duplas cada'),
          match('Formato', 'Todos contra todos em cada grupo (10 jogos por grupo)'),
          match('Total', '20 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Quartas de final',
        matches: [
          match('QF1', '1º Grupo A × 4º Grupo B'),
          match('QF2', '2º Grupo A × 3º Grupo B'),
          match('QF3', '3º Grupo A × 2º Grupo B'),
          match('QF4', '4º Grupo A × 1º Grupo B'),
        ],
      },
      {
        phase: 'Semifinal',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
        ],
      },
    ],
  },
  '2_groups_6_cross_semis': {
    title: '2 Grupos de 6 - Cruzado + Semi/Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '2 grupos com 6 duplas cada'),
          match('Formato', 'Cruzado: cada dupla de um grupo joga contra todas do outro grupo'),
          match('Total', '36 jogos na fase de grupos (6 × 6)'),
          match('Grupo A', 'Seeds: 1, 3, 5, 7, 9, 11'),
          match('Grupo B', 'Seeds: 2, 4, 6, 8, 10, 12'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'A definir manualmente (escolha os 4 semi-finalistas)'),
          match('SF2', 'A definir manualmente (escolha os 4 semi-finalistas)'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '2_groups_3_cross_semis': {
    title: '2 Grupos de 3 - Cruzado + Semi/Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '2 grupos com 3 duplas cada'),
          match('Formato', 'Cruzado: cada dupla de um grupo joga contra todas do outro grupo'),
          match('Total', '9 jogos na fase de grupos (3 × 3)'),
          match('Grupo A', 'Seeds: 1, 3, 5'),
          match('Grupo B', 'Seeds: 2, 4, 6'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', '1º Grupo A × 2º Grupo A'),
          match('SF2', '1º Grupo B × 2º Grupo B'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '6_teams_round_robin': {
    title: '6 Duplas - Todos contra Todos + Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '1 grupo único com 6 duplas'),
          match('Formato', 'Todos contra todos (round-robin)'),
          match('Total de jogos', '15 jogos na fase de grupos'),
          match('Cálculo', 'Cada dupla joga 5 jogos (6 × 5 / 2 = 15)'),
        ],
      },
      {
        phase: 'Classificação',
        matches: [
          match('Critérios', '1º: Pontos de jogo, 2º: Diferença de sets, 3º: Diferença de pontos'),
          match('Final', '1º Colocado × 2º Colocado'),
          match('3º lugar', '3º Colocado × 4º Colocado (opcional)'),
        ],
      },
      {
        phase: 'Finais',
        matches: [
          match('Final', '1º Colocado × 2º Colocado', 'Final'),
          match('3º lugar', '3º Colocado × 4º Colocado', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '5_teams_round_robin': {
    title: '5 Duplas - Todos contra Todos + Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '1 grupo único com 5 duplas'),
          match('Formato', 'Todos contra todos (round-robin)'),
          match('Total de jogos', '10 jogos na fase de grupos'),
          match('Cálculo', 'Cada dupla joga 4 jogos (5 × 4 / 2 = 10)'),
        ],
      },
      {
        phase: 'Classificação',
        matches: [
          match('Critérios', '1º: Pontos de jogo, 2º: Diferença de sets, 3º: Diferença de pontos'),
          match('Final', '1º Colocado × 2º Colocado'),
          match('3º lugar', '3º Colocado × 4º Colocado (opcional)'),
        ],
      },
      {
        phase: 'Finais',
        matches: [
          match('Final', '1º Colocado × 2º Colocado', 'Final'),
          match('3º lugar', '3º Colocado × 4º Colocado', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '3_groups_3_semis': {
    title: '3 Grupos de 3 - Semifinal',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '3 grupos com 3 equipes cada'),
          match('Formato', 'Todos contra todos em cada grupo (3 jogos por grupo)'),
          match('Total', '9 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Classificação',
        matches: [
          match('Avanço', '3 primeiros colocados de cada grupo (3 equipes)'),
          match('Melhor 2º', '+ 1 melhor 2º colocado'),
          match('Total', '4 equipes nas semifinais'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', '1º Grupo A × Melhor 2º'),
          match('SF2', '1º Grupo B × 1º Grupo C'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '3_groups_3_quarterfinals': {
    title: '3 Grupos de 3 - Quartas de Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '3 grupos com 3 equipes cada'),
          match('Formato', 'Todos contra todos em cada grupo (3 jogos por grupo)'),
          match('Total', '9 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Classificação para Quartas',
        matches: [
          match('Avanço', '3 primeiros colocados de cada grupo (3 equipes)'),
          match('Melhores 2º', '+ 5 melhores 2º colocados'),
          match('Total', '8 equipes nas quartas de final'),
        ],
      },
      {
        phase: 'Quartas de Final',
        matches: [
          match('QF1', '1º Grupo A × Melhor 2º'),
          match('QF2', '1º Grupo B × 2º Melhor 2º'),
          match('QF3', '1º Grupo C × 3º Melhor 2º'),
          match('QF4', '2º Grupo A × 4º Melhor 2º'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
  '5_groups_3_quarterfinals': {
    title: '5 Grupos de 3 - Quartas de Final',
    sections: [
      {
        phase: 'Fase de Grupos',
        matches: [
          match('Estrutura', '5 grupos com 3 equipes cada'),
          match('Formato', 'Todos contra todos em cada grupo (3 jogos por grupo)'),
          match('Total', '15 jogos na fase de grupos'),
        ],
      },
      {
        phase: 'Classificação para Quartas',
        matches: [
          match('Avanço', '5 primeiros colocados de cada grupo (5 equipes)'),
          match('Melhores 2º', '+ 3 melhores 2º colocados'),
          match('Total', '8 equipes nas quartas de final'),
        ],
      },
      {
        phase: 'Quartas de Final',
        matches: [
          match('QF1', '1º Grupo A × Melhor 2º'),
          match('QF2', '1º Grupo B × 2º Melhor 2º'),
          match('QF3', '1º Grupo C × 3º Melhor 2º'),
          match('QF4', '1º Grupo D × 1º Grupo E'),
        ],
      },
      {
        phase: 'Semifinais',
        matches: [
          match('SF1', 'Venc. QF1 × Venc. QF2'),
          match('SF2', 'Venc. QF3 × Venc. QF4'),
        ],
      },
      {
        phase: 'Final',
        matches: [
          match('Final', 'Venc. SF1 × Venc. SF2', 'Final'),
          match('3º lugar', 'Perd. SF1 × Perd. SF2', 'Disputa 3º lugar'),
        ],
      },
    ],
  },
}

const singularize = (value: string) => {
  if (value.endsWith('ais')) {
    return `${value.slice(0, -3)}al`
  }
  if (value.endsWith('ões')) {
    return `${value.slice(0, -3)}ao`
  }
  if (value.endsWith('s') && !value.endsWith('ss')) {
    return value.slice(0, -1)
  }
  return value
}

export const getBracketSectionForPhase = (
  formatId: TournamentFormatId | null | undefined,
  phase: string,
): BracketSection | null => {
  if (!formatId) return null
  const criteria = bracketCriteriaByFormat[formatId]
  if (!criteria) return null
  const normalized = normalizePhaseName(phase)
  const singularNormalized = singularize(normalized)

  for (const section of criteria.sections) {
    const sectionNormalized = normalizePhaseName(section.phase)
    if (sectionNormalized === normalized) {
      return section
    }
    if (singularize(sectionNormalized) === singularNormalized) {
      return section
    }
  }

  return null
}
