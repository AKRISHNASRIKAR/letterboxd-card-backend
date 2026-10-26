import { scrapeStats } from './letterboxd'
import { getCached, setCached, statsCacheKey, statsCacheTtl, isStatsCacheFresh } from './cache.service'
import type { LetterboxdStats } from '../types/letterboxd'

export interface ProfileResult {
  stats: LetterboxdStats
  cacheHit: boolean
}

// The website requests JSON and SVG concurrently. Share the work in this process;
// separate serverless instances still coordinate through Redis on later requests.
const pending = new Map<string, Promise<ProfileResult>>()

export function getProfileStats(user: string): Promise<ProfileResult> {
  const key = statsCacheKey(user)
  const active = pending.get(key)
  if (active) return active

  const request = (async () => {
    const cached = await getCached<LetterboxdStats>(key)
    if (cached && isStatsCacheFresh(cached)) return { stats: cached, cacheHit: true }

    const stats = await scrapeStats(user)
    await setCached(key, stats, statsCacheTtl(stats))
    return { stats, cacheHit: false }
  })()
  pending.set(key, request)
  // Clean up after success and failure so a failed scrape never poisons retries.
  void request.then(() => pending.delete(key), () => pending.delete(key))
  return request
}
