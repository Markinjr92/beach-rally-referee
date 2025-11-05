export type NormalizedMatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled'

const STATUS_ALIASES: Record<NormalizedMatchStatus, string[]> = {
  scheduled: ['scheduled', 'agendado'],
  in_progress: ['in_progress', 'em_andamento'],
  completed: ['completed', 'finalizado', 'finalized', 'finished'],
  canceled: ['canceled', 'cancelado', 'cancelled'],
}

export const normalizeMatchStatus = (
  status: string | null | undefined,
): NormalizedMatchStatus | null => {
  if (!status) return null
  const normalized = status.toLowerCase()
  return (Object.entries(STATUS_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] ?? null) as
    | NormalizedMatchStatus
    | null
}

export const isMatchCompleted = (status: string | null | undefined): boolean => {
  return normalizeMatchStatus(status) === 'completed'
}

export const isMatchInProgress = (status: string | null | undefined): boolean => {
  return normalizeMatchStatus(status) === 'in_progress'
}
