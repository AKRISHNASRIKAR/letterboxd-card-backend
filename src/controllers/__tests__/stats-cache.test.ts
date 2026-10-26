import type { Request, Response } from 'express'
import { getStats } from '../stats.controller'
import { getCard } from '../card.controller'
import { getCached, setCached, isStatsCacheFresh, statsCacheTtl } from '../../services/cache.service'
import { scrapeStats } from '../../services/letterboxd'
import { renderCard } from '../../services/card/renderer'
import { emptyProfile } from '../../services/letterboxd/parser'
import { transform } from '../../services/letterboxd/transformer'
import type { LetterboxdStats } from '../../types/letterboxd'

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }))
jest.mock('../../services/cache.service', () => ({
  ...jest.requireActual('../../services/cache.service'),
  getCached: jest.fn(), setCached: jest.fn(),
}))
jest.mock('../../services/letterboxd', () => ({ scrapeStats: jest.fn() }))
jest.mock('../../services/card/renderer', () => ({ renderCard: jest.fn() }))

function profile(accuracy: 'exact' | 'lower_bound', age: number): LetterboxdStats {
  const raw = emptyProfile()
  raw.thisYear = accuracy === 'exact' ? 100 : 48
  raw.thisYearInfo = { year: 2026, accuracy, source: accuracy === 'exact' ? 'profile' : 'rss' }
  return { ...transform(raw), fetchedAt: Date.now() - age }
}
function response() {
  return {
    locals: { params: { user: 'fixture', count: 4 } },
    json: jest.fn(), setHeader: jest.fn(), send: jest.fn(),
  } as unknown as Response
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T12:00:00Z'))
  jest.resetAllMocks()
  jest.mocked(setCached).mockResolvedValue()
  jest.mocked(scrapeStats).mockResolvedValue(profile('exact', 0))
  jest.mocked(renderCard).mockResolvedValue(Buffer.from('<svg/>'))
})
afterEach(() => jest.useRealTimers())

test('stats endpoint replaces an old hour-cached 48+ with the retrieved exact 100', async () => {
  jest.mocked(getCached).mockResolvedValue(profile('lower_bound', 120000))
  const res = response(), next = jest.fn()
  await getStats({} as Request, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(scrapeStats).toHaveBeenCalledWith('fixture')
  expect(res.json).toHaveBeenCalledWith({ data: expect.objectContaining({ stats: expect.objectContaining({ thisYear: 100 }) }), cached: false })
  expect(setCached).toHaveBeenCalledWith('stats:v5:2026:fixture', expect.anything(), 3600)
})
test('card endpoint renders the exact result after an incomplete cache expires', async () => {
  jest.mocked(getCached).mockResolvedValue(profile('lower_bound', 120000))
  const res = response(), next = jest.fn()
  await getCard({} as Request, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(renderCard).toHaveBeenCalledWith(expect.objectContaining({ stats: expect.objectContaining({ thisYear: 100 }) }), 4)
  expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS')
})
test('fresh exact data continues to avoid unnecessary scraping', async () => {
  const exact = profile('exact', 120000)
  jest.mocked(getCached).mockResolvedValue(exact)
  const res = response()
  await getStats({} as Request, res, jest.fn())
  expect(scrapeStats).not.toHaveBeenCalled()
  expect(res.json).toHaveBeenCalledWith({ data: exact, cached: true })
})
test('fresh partial data throttles recovery attempts for one minute', async () => {
  jest.mocked(getCached).mockResolvedValue(profile('lower_bound', 30000))
  await getStats({} as Request, response(), jest.fn())
  expect(scrapeStats).not.toHaveBeenCalled()
})
test('a still-blocked profile is cached for 60 seconds rather than one hour', async () => {
  jest.mocked(getCached).mockResolvedValue(null)
  jest.mocked(scrapeStats).mockResolvedValue(profile('lower_bound', 0))
  await getStats({} as Request, response(), jest.fn())
  expect(setCached).toHaveBeenCalledWith('stats:v5:2026:fixture', expect.anything(), 60)
})
test('partial SVG cannot remain in the CDN stale cache for an additional day', async () => {
  jest.mocked(getCached).mockResolvedValue(profile('lower_bound', 30000))
  const res = response()
  await getCard({} as Request, res, jest.fn())
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'max-age=0, s-maxage=60, must-revalidate')
  expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT')
})
test('cache validity checks the year and retries exactly at the one-minute boundary', () => {
  expect(isStatsCacheFresh(profile('lower_bound', 60000))).toBe(false)
  const previousYear = profile('exact', 0)
  previousYear.thisYearInfo.year = 2025
  expect(isStatsCacheFresh(previousYear)).toBe(false)
})
test('unavailable counts also get the short retry TTL', () => {
  const unavailable = profile('lower_bound', 0)
  unavailable.thisYearInfo.accuracy = 'unavailable'
  expect(statsCacheTtl(unavailable)).toBe(60)
})
