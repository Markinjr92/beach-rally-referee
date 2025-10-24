const TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i

const sanitizeDateInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const normalized = trimmed.replace(' ', 'T')
  const [datePart, timePartRaw = ''] = normalized.split('T')
  const timePart = timePartRaw.replace(TIMEZONE_PATTERN, '')
  return `${datePart}T${timePart}`.replace(/T$/, '')
}

export const parseLocalDateTime = (value: string | null): Date | null => {
  if (!value) return null
  const sanitized = sanitizeDateInput(value)
  if (!sanitized) return null
  const [datePart, timePart = ''] = sanitized.split('T')
  if (!datePart) return null

  const [yearStr, monthStr, dayStr] = datePart.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10) - 1
  const day = Number.parseInt(dayStr, 10)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null

  const [hoursStr = '0', minutesStr = '0', secondsStr = '0'] = timePart.split(':')
  const hours = Number.parseInt(hoursStr, 10)
  const minutes = Number.parseInt(minutesStr, 10)
  const seconds = Number.parseInt(secondsStr, 10)

  return new Date(
    year,
    month,
    day,
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    Number.isNaN(seconds) ? 0 : seconds
  )
}

export const formatDateTimePtBr = (
  value: string | null,
  { fallback = 'Sem horário definido' }: { fallback?: string } = {}
) => {
  const date = parseLocalDateTime(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export const formatDatePtBr = (
  value: string | null,
  { fallback = '-' }: { fallback?: string } = {}
) => {
  const date = parseLocalDateTime(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)
}

export const formatDateShortPtBr = (
  value: string | null,
  { fallback = '-' }: { fallback?: string } = {}
) => {
  const date = parseLocalDateTime(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export const formatDateMediumPtBr = (
  value: string | null,
  { fallback = '-' }: { fallback?: string } = {}
) => {
  const date = parseLocalDateTime(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}
