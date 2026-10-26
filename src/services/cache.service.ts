// Cache service
import { Redis } from "@upstash/redis"
import type { LetterboxdStats } from "../types/letterboxd"
 
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
 
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key)
  } catch {
    return null   // degrade gracefully — never crash on cache miss
  }
}
 
export async function setCached<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttl })
  } catch {
    // non-fatal
  }
}
 
export async function bustCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length) await redis.del(...keys)
}
/** Versioned and year-scoped so old RSS totals and last year cannot be reused. */
export const statsCacheKey = (user: string, year = new Date().getUTCFullYear()) =>
  `stats:v5:${year}:${user}`

/** Retry incomplete profiles soon instead of freezing a transient block for an hour. */
export const statsCacheTtl = (stats: LetterboxdStats): number =>
  stats.thisYearInfo?.accuracy === "exact" ? 3600 : 60

/** Also expires partial records written with the old one-hour Redis TTL. */
export function isStatsCacheFresh(stats: LetterboxdStats): boolean {
  if (stats.thisYearInfo?.year !== new Date().getUTCFullYear()) return false
  const age = Date.now() - stats.fetchedAt
  return Number.isFinite(age) && age >= 0 && age < statsCacheTtl(stats) * 1000
}
