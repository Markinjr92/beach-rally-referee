import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'tournament-chat-usage:'

interface UsageRecord {
  count: number
  firstAt: string
  lastAt: string
}

const readUsage = (key: string): UsageRecord => {
  if (typeof window === 'undefined') {
    return { count: 0, firstAt: '', lastAt: '' }
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { count: 0, firstAt: '', lastAt: '' }
    const parsed = JSON.parse(raw) as Partial<UsageRecord>
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      firstAt: typeof parsed.firstAt === 'string' ? parsed.firstAt : '',
      lastAt: typeof parsed.lastAt === 'string' ? parsed.lastAt : '',
    }
  } catch {
    return { count: 0, firstAt: '', lastAt: '' }
  }
}

const writeUsage = (key: string, record: UsageRecord) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(record))
  } catch {
    // ignore quota / privacy mode errors
  }
}

interface ChatRateLimitOptions {
  tournamentId: string
  limit?: number
}

interface ChatRateLimitResult {
  used: number
  remaining: number
  limit: number
  canAsk: boolean
  recordQuestion: () => void
  reset: () => void
}

export function useChatRateLimit({ tournamentId, limit = 5 }: ChatRateLimitOptions): ChatRateLimitResult {
  const storageKey = `${STORAGE_PREFIX}${tournamentId}`
  const [used, setUsed] = useState<number>(() => readUsage(storageKey).count)

  useEffect(() => {
    setUsed(readUsage(storageKey).count)
  }, [storageKey])

  const recordQuestion = useCallback(() => {
    const current = readUsage(storageKey)
    const nowIso = new Date().toISOString()
    const next: UsageRecord = {
      count: current.count + 1,
      firstAt: current.firstAt || nowIso,
      lastAt: nowIso,
    }
    writeUsage(storageKey, next)
    setUsed(next.count)
  }, [storageKey])

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
    setUsed(0)
  }, [storageKey])

  const remaining = Math.max(limit - used, 0)
  return {
    used,
    remaining,
    limit,
    canAsk: remaining > 0,
    recordQuestion,
    reset,
  }
}
