// Cache service
import { Redis } from "@upstash/redis"
 
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