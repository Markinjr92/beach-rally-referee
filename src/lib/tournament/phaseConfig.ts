import { TournamentFormatId } from '@/types/volleyball'
import { getPhaseSequencesFromDefinitions } from './bracket/definitions'
import { normalizePhaseName, phaseFormatKeyMap } from './bracket/phases'

export { normalizePhaseName, phaseFormatKeyMap }

/** Sequências de fase derivadas das definições declarativas de bracket */
export const phaseSequences: Partial<Record<TournamentFormatId, string[]>> =
  getPhaseSequencesFromDefinitions()

export const getNextPhaseLabel = (
  formatId: TournamentFormatId | null | undefined,
  currentPhase?: string,
): string | null => {
  if (!formatId || !currentPhase) return null
  const sequence = phaseSequences[formatId]
  if (!sequence || !sequence.length) return null
  const index = sequence.findIndex(
    (phase) => normalizePhaseName(phase) === normalizePhaseName(currentPhase),
  )
  if (index === -1 || index >= sequence.length - 1) return null
  return sequence[index + 1]
}
