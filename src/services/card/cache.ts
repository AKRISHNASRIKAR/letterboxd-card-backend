import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { LetterboxdStats } from '../../types/letterboxd'
import { getCached, setCached, statsCacheTtl } from '../cache.service'
import { renderCard } from './renderer'

interface CardResult {
  svg: Buffer
  cacheHit: boolean
}

const pending = new Map<string, Promise<CardResult>>()
const recent = new Map<string, { svg: Buffer; expiresAt: number }>()
const MAX_RECENT_CARDS = 16

function remember(key: string, svg: Buffer, expiresAt: number): void {
  recent.delete(key)
  recent.set(key, { svg, expiresAt })
  while (recent.size > MAX_RECENT_CARDS) recent.delete(recent.keys().next().value!)
}

export function cardCacheKey(stats: LetterboxdStats, count: number): string {
  // Include the entire snapshot: an exact count replacing a partial count, a
  // changed poster URL, or a refreshed timestamp must never reuse the old SVG.
  const hash = createHash('sha256').update(JSON.stringify(stats)).digest('hex')
  return `card:v2:${hash}:${Math.min(count, 4)}`
}

export function getRenderedCard(stats: LetterboxdStats, count: number): Promise<CardResult> {
  const key = cardCacheKey(stats, count)
  const expiresAt = stats.fetchedAt + statsCacheTtl(stats) * 1000
  const local = recent.get(key)
  if (local && local.expiresAt > Date.now()) {
    remember(key, local.svg, local.expiresAt)
    return Promise.resolve({ svg: local.svg, cacheHit: true })
  }
  recent.delete(key)
  const active = pending.get(key)
  if (active) return active

  const request = (async () => {
    const cached = await getCached<string>(key)
    if (typeof cached === 'string') {
      try {
        const svg = cached.startsWith('gz:')
          ? gunzipSync(Buffer.from(cached.slice(3), 'base64'))
          : Buffer.from(cached)
        if (svg.toString('utf8', 0, 4) === '<svg') {
          remember(key, svg, expiresAt)
          return { svg, cacheHit: true }
        }
      } catch {
        // A corrupt cache entry must not break card generation.
      }
    }
    const svg = await renderCard(stats, count)
    remember(key, svg, expiresAt)
    // Do not extend a partial count's lifetime each time its card is requested.
    const remaining = Math.floor((expiresAt - Date.now()) / 1000)
    if (remaining > 0) await setCached(key, `gz:${gzipSync(svg).toString('base64')}`, remaining)
    return { svg, cacheHit: false }
  })()
  pending.set(key, request)
  void request.then(() => pending.delete(key), () => pending.delete(key))
  return request
}
