import { TournamentFormatId } from '@/types/volleyball'

interface BracketCriteriaProps {
  formatId: TournamentFormatId | null | undefined
  className?: string
}

export function TournamentBracketCriteria({ formatId, className = '' }: BracketCriteriaProps) {
  if (!formatId) return null

  const criteriaByFormat: Record<TournamentFormatId, { title: string; sections: { phase: string; matches: string[] }[] }> = {
    groups_and_knockout: {
      title: 'Grupos + Eliminatória (4 grupos de 3)',
      sections: [
        {
          phase: 'Fase de Grupos',
          matches: [
            '4 grupos com 3 duplas cada',
            'Todos contra todos em cada grupo (3 jogos por grupo)',
            'Total: 12 jogos na fase de grupos',
          ],
        },
        {
          phase: 'Quartas de Final',
          matches: [
            'QF1: 1º Grupo A × 2º Grupo D',
            'QF2: 1º Grupo B × 2º Grupo C',
            'QF3: 1º Grupo C × 2º Grupo B',
            'QF4: 1º Grupo D × 2º Grupo A',
          ],
        },
        {
          phase: 'Semifinais',
          matches: [
            'SF1: Venc. QF1 × Venc. QF2',
            'SF2: Venc. QF3 × Venc. QF4',
          ],
        },
        {
          phase: 'Final',
          matches: [
            'Final: Venc. SF1 × Venc. SF2',
            '3º lugar: Perd. SF1 × Perd. SF2',
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
            '3 grupos com 4 duplas cada',
            'Todos contra todos em cada grupo (6 jogos por grupo)',
            'Total: 18 jogos na fase de grupos',
            'Ordem dos jogos: A1×A2, A3×A4, A1×A3, A2×A4, A1×A4, A2×A3',
          ],
        },
        {
          phase: 'Classificação para Quartas',
          matches: [
            'Classificam: 1º e 2º de cada grupo (6 duplas)',
            '+ 2 melhores 3º colocados',
            'Total: 8 duplas nas quartas de final',
          ],
        },
        {
          phase: 'Quartas de Final',
          matches: [
            'QF1: 1º Grupo A × Melhor 3º',
            'QF2: 1º Grupo B × 2º Grupo C',
            'QF3: 1º Grupo C × 2º Grupo B',
            'QF4: 2º Grupo A × 2º Melhor 3º',
          ],
        },
        {
          phase: 'Semifinais',
          matches: [
            'SF1: Venc. QF1 × Venc. QF2',
            'SF2: Venc. QF3 × Venc. QF4',
          ],
        },
        {
          phase: 'Final',
          matches: [
            'Final: Venc. SF1 × Venc. SF2',
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
            '3 grupos com 4 duplas cada',
            'Todos contra todos em cada grupo (6 jogos por grupo)',
            'Total: 18 jogos na fase de grupos',
          ],
        },
        {
          phase: 'Classificação Geral',
          matches: [
            'Ranking geral: todas as duplas dos 3 grupos',
            'Classificam os 4 melhores do ranking geral',
          ],
        },
        {
          phase: 'Semifinais',
          matches: [
            'SF1: 1º Geral × 4º Geral',
            'SF2: 2º Geral × 3º Geral',
          ],
        },
        {
          phase: 'Final',
          matches: [
            'Final: Venc. SF1 × Venc. SF2',
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
            '3 grupos com 4 duplas cada',
            'Todos contra todos em cada grupo (6 jogos por grupo)',
            'Total: 18 jogos na fase de grupos',
          ],
        },
        {
          phase: 'Classificação',
          matches: [
            'Série Ouro: 2 melhores de cada grupo (6 duplas)',
            'Série Prata: Demais duplas (6 duplas)',
          ],
        },
        {
          phase: 'Série Ouro',
          matches: [
            'SF Ouro 1: 1º × 4º',
            'SF Ouro 2: 2º × 3º',
            'Final Ouro',
            '3º lugar Ouro',
          ],
        },
        {
          phase: 'Série Prata',
          matches: [
            'SF Prata 1: 1º × 4º',
            'SF Prata 2: 2º × 3º',
            'Final Prata',
            '3º lugar Prata',
          ],
        },
      ],
    },
    single_elimination: {
      title: 'Eliminatória Simples',
      sections: [
        {
          phase: 'Primeira Rodada (Play-in)',
          matches: [
            'R1-1: Seed 5 × Seed 12',
            'R1-2: Seed 8 × Seed 9',
            'R1-3: Seed 6 × Seed 11',
            'R1-4: Seed 7 × Seed 10',
          ],
        },
        {
          phase: 'Quartas de Final',
          matches: [
            'QF1: Seed 1 × Venc. R1-1',
            'QF2: Seed 4 × Venc. R1-2',
            'QF3: Seed 3 × Venc. R1-3',
            'QF4: Seed 2 × Venc. R1-4',
          ],
        },
        {
          phase: 'Semifinais',
          matches: [
            'SF1: Venc. QF1 × Venc. QF2',
            'SF2: Venc. QF3 × Venc. QF4',
          ],
        },
        {
          phase: 'Final',
          matches: [
            'Final: Venc. SF1 × Venc. SF2',
            '3º lugar: Perd. SF1 × Perd. SF2',
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
            'WR1-1: Seed 5 × Seed 12',
            'WR1-2: Seed 8 × Seed 9',
            'WR1-3: Seed 6 × Seed 11',
            'WR1-4: Seed 7 × Seed 10',
          ],
        },
        {
          phase: 'Chave de Vencedores - R2',
          matches: [
            'WR2-1: Seed 1 × Venc. WR1-1',
            'WR2-2: Seed 4 × Venc. WR1-2',
            'WR2-3: Seed 3 × Venc. WR1-3',
            'WR2-4: Seed 2 × Venc. WR1-4',
          ],
        },
        {
          phase: 'Chave de Vencedores - R3 e R4',
          matches: [
            'WR3-1: Venc. WR2-1 × Venc. WR2-2',
            'WR3-2: Venc. WR2-3 × Venc. WR2-4',
            'WR4: Venc. WR3-1 × Venc. WR3-2',
          ],
        },
        {
          phase: 'Chave de Repescagem',
          matches: [
            'Perdedores da chave de vencedores enfrentam-se',
            'Vencedor da repescagem avança para a Grande Final',
          ],
        },
        {
          phase: 'Grande Final',
          matches: [
            'Final: Venc. Chave Vencedores × Venc. Repescagem',
            'Se necessário: Jogo Extra (dupla eliminação)',
          ],
        },
      ],
    },
  }

  const criteria = criteriaByFormat[formatId]
  if (!criteria) return null

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{criteria.title}</h4>
      </div>
      <div className="space-y-4">
        {criteria.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              {section.phase}
            </h5>
            <ul className="space-y-1 text-xs text-white/80">
              {section.matches.map((match, matchIndex) => (
                <li key={matchIndex} className="flex items-start gap-2">
                  <span className="text-white/40 mt-0.5">•</span>
                  <span>{match}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}


