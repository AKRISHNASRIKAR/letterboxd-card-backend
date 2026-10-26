import { gzipSync } from 'node:zlib'
import { getRenderedCard, cardCacheKey } from '../cache'
import { getCached, setCached } from '../../cache.service'
import { renderCard } from '../renderer'
import { emptyProfile } from '../../letterboxd/parser'
import { transform } from '../../letterboxd/transformer'

jest.mock('../../cache.service', () => ({
  ...jest.requireActual('../../cache.service'), getCached: jest.fn(), setCached: jest.fn(),
}))
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }))
jest.mock('../renderer', () => ({ renderCard: jest.fn() }))

let fixtureNumber = 0
function stats() {
  const raw = emptyProfile()
  raw.username = `fixture-${fixtureNumber}`
  raw.thisYear = 100
  raw.thisYearInfo = { year: 2026, accuracy: 'exact', source: 'profile' }
  return transform(raw)
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T12:00:00Z'))
  jest.resetAllMocks()
  fixtureNumber++
  jest.mocked(getCached).mockResolvedValue(null)
  jest.mocked(setCached).mockResolvedValue()
  jest.mocked(renderCard).mockResolvedValue(Buffer.from('<svg>100</svg>'))
})
afterEach(() => jest.useRealTimers())

test('a rendered cache hit avoids rendering and external asset downloads', async () => {
  jest.mocked(getCached).mockResolvedValue('<svg>cached</svg>')
  const result = await getRenderedCard(stats(), 4)
  expect(result.svg.toString()).toBe('<svg>cached</svg>')
  expect(result.cacheHit).toBe(true)
  expect(renderCard).not.toHaveBeenCalled()
})
test('a changed count selects a different rendered card', () => {
  const s = stats()
  expect(cardCacheKey(s, 2)).not.toBe(cardCacheKey(s, 4))
})
test('replacing a partial count with an exact count cannot reuse the old SVG', () => {
  const exact = stats()
  const partial = { ...exact, stats: { ...exact.stats, thisYear: 48 }, thisYearInfo: { ...exact.thisYearInfo, accuracy: 'lower_bound' as const, source: 'rss' as const } }
  expect(cardCacheKey(partial, 4)).not.toBe(cardCacheKey(exact, 4))
})
test('new profile snapshots and changed poster URLs invalidate the rendered card', () => {
  const s = stats()
  expect(cardCacheKey(s, 4)).not.toBe(cardCacheKey({ ...s, fetchedAt: s.fetchedAt + 1 }, 4))
  expect(cardCacheKey(s, 4)).not.toBe(cardCacheKey({ ...s, avatar: 'https://example.com/new.jpg' }, 4))
})
test('the SVG cache never extends an incomplete profile lifetime', async () => {
  const s = stats()
  s.thisYearInfo.accuracy = 'lower_bound'
  s.fetchedAt -= 45000
  await getRenderedCard(s, 4)
  expect(setCached).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^gz:/), 15)
})
test('concurrent requests for the same snapshot render only once', async () => {
  const s = stats()
  await Promise.all([getRenderedCard(s, 4), getRenderedCard(s, 4)])
  expect(renderCard).toHaveBeenCalledTimes(1)
})
test('failed renders can be retried', async () => {
  const s = stats()
  jest.mocked(renderCard).mockRejectedValueOnce(new Error('failed'))
  await expect(getRenderedCard(s, 4)).rejects.toThrow('failed')
  await expect(getRenderedCard(s, 4)).resolves.toHaveProperty('cacheHit', false)
  expect(renderCard).toHaveBeenCalledTimes(2)
})

test('repeated warm-instance requests avoid Redis and rendering', async () => {
  const s = stats()
  await getRenderedCard(s, 4)
  await getRenderedCard(s, 4)
  expect(getCached).toHaveBeenCalledTimes(1)
  expect(renderCard).toHaveBeenCalledTimes(1)
})
test('compressed Redis cards decode without rendering', async () => {
  jest.mocked(getCached).mockResolvedValue(`gz:${gzipSync('<svg>compressed</svg>').toString('base64')}`)
  const result = await getRenderedCard(stats(), 4)
  expect(result.svg.toString()).toBe('<svg>compressed</svg>')
  expect(renderCard).not.toHaveBeenCalled()
})
test('a corrupt compressed card is regenerated', async () => {
  jest.mocked(getCached).mockResolvedValue('gz:invalid')
  await expect(getRenderedCard(stats(), 4)).resolves.toHaveProperty('cacheHit', false)
  expect(renderCard).toHaveBeenCalledTimes(1)
})
