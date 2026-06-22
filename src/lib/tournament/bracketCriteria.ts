import { TournamentFormatId } from '@/types/volleyball'
import { bracketCriteriaFromDefinitions } from './bracket/toBracketCriteria'
import { normalizePhaseName } from './bracket/phases'
import type { BracketCriteria, BracketSection } from './bracket/criteriaTypes'

export type {
  BracketMatchDescriptor,
  BracketSection,
  BracketCriteria,
} from './bracket/criteriaTypes'

export const bracketCriteriaByFormat: Record<TournamentFormatId, BracketCriteria> =
  bracketCriteriaFromDefinitions as Record<TournamentFormatId, BracketCriteria>

const singularize = (value: string) => {
  if (value.endsWith('ais') && value.length > 3) {
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
