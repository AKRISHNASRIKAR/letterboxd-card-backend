import { parseProfile, parseRss } from '../parser'
import { scrapeStats } from '../index'
import * as scraper from '../scraper'
import { formatYearCount } from '../../card/renderer'
import { statsCacheKey } from '../../cache.service'
import { transform } from '../transformer'
import { emptyProfile } from '../parser'

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }))
jest.mock('../scraper', () => ({
  ...jest.requireActual('../scraper'),
  fetchProfile: jest.fn(), fetchFilms: jest.fn(), fetchNetwork: jest.fn(),
  fetchLists: jest.fn(), fetchRss: jest.fn(),
}))

const profile = (value: string, year = 2026) =>
  `<div class="profile-stats"><a href="/fixture/diary/for/${year}/"><span class="value">${value}</span></a></div>`
const feed = (dates: string[]) => `<rss xmlns:letterboxd="https://letterboxd.com"><channel><title>Letterboxd - Fixture</title>${dates.map((date, i) => `<item><link>https://letterboxd.com/fixture/film/film-${i}/</link><letterboxd:watchedDate>${date}</letterboxd:watchedDate><letterboxd:filmTitle>Film</letterboxd:filmTitle><letterboxd:filmYear>1999</letterboxd:filmYear><pubDate>Mon, 26 Oct 2026 00:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T12:00:00Z'))
  jest.resetAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.mocked(scraper.fetchProfile).mockRejectedValue(new scraper.BlockedError('profile'))
  jest.mocked(scraper.fetchFilms).mockResolvedValue('<html></html>')
  jest.mocked(scraper.fetchNetwork).mockResolvedValue('<html></html>')
  jest.mocked(scraper.fetchLists).mockResolvedValue('<html></html>')
  jest.mocked(scraper.fetchRss).mockResolvedValue(feed(['2026-10-25', '2025-11-14']))
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

test('profile extracts a full comma-separated count', () => {
  expect(parseProfile(profile('1,234')).thisYear).toBe(1234)
})
test('an explicit zero is exact, not a missing value', async () => {
  jest.mocked(scraper.fetchProfile).mockResolvedValue(profile('0'))
  const result = await scrapeStats('fixture')
  expect(result.stats.thisYear).toBe(0)
  expect(result.thisYearInfo.accuracy).toBe('exact')
})
test('a profile link from the previous year is not authoritative', () => {
  expect(parseProfile(profile('150', 2025)).thisYearInfo.accuracy).toBe('unavailable')
})
test('a malformed profile count is unavailable rather than exact zero', () => {
  expect(parseProfile(profile('')).thisYearInfo.accuracy).toBe('unavailable')
})
test('RSS uses watched dates, not film release or publication years', () => {
  expect(parseRss(feed(['2026-10-25', '2025-11-14'])).thisYear).toBe(1)
})
test('RSS remains a lower bound even when older watched dates appear', () => {
  expect(parseRss(feed(['2026-10-25', '2025-11-14'])).thisYearIsFloor).toBe(true)
})
test('profile total takes precedence over the RSS window', async () => {
  jest.mocked(scraper.fetchProfile).mockResolvedValue(profile('104'))
  const result = await scrapeStats('fixture')
  expect(result.stats.thisYear).toBe(104)
  expect(result.thisYearInfo.source).toBe('profile')
})
test('blocked full sources preserve an explicitly marked RSS lower bound', async () => {
  const result = await scrapeStats('fixture')
  expect(result.stats.thisYear).toBe(1)
  expect(result.thisYearInfo.accuracy).toBe('lower_bound')
  expect(formatYearCount(result)).toBe('1+')
})
test('unavailable sources show a dash rather than an invented zero', async () => {
  jest.mocked(scraper.fetchRss).mockRejectedValue(new Error('network'))
  const result = await scrapeStats('fixture')
  expect(result.thisYearInfo.accuracy).toBe('unavailable')
  expect(formatYearCount(result)).toBe('—')
})
test('exact counts render without a plus suffix', () => {
  const raw = emptyProfile()
  raw.thisYear = 104
  raw.thisYearInfo = { year: 2026, accuracy: 'exact', source: 'profile' }
  expect(formatYearCount(transform(raw))).toBe('104')
})
test('cache keys separate years and invalidate the old stats:v4 values', () => {
  expect(statsCacheKey('fixture')).toBe('stats:v5:2026:fixture')
  jest.setSystemTime(new Date('2027-01-01T00:00:00Z'))
  expect(statsCacheKey('fixture')).toBe('stats:v5:2027:fixture')
})

test('RSS lower bound deduplicates rewatches of the same film', () => {
  const xml = feed(['2026-10-25', '2026-10-24']).replace('film-1/', 'film-0/')
  expect(parseRss(xml).thisYear).toBe(1)
})

test('a cold blocked-profile result explicitly identifies the upstream failure', async () => {
  const result = await scrapeStats('fixture')
  expect(result.thisYearInfo.reason).toBe('profile_blocked')
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('letterboxd_year_count_incomplete'))
})
test('a successful fetch with missing year markup is distinguished from blocking', async () => {
  jest.mocked(scraper.fetchProfile).mockResolvedValue('<main>Profile without yearly statistic</main>')
  expect((await scrapeStats('fixture')).thisYearInfo.reason).toBe('profile_count_missing')
})
test('network failures are distinguished from upstream blocks', async () => {
  jest.mocked(scraper.fetchProfile).mockRejectedValue(new Error('network failure'))
  expect((await scrapeStats('fixture')).thisYearInfo.reason).toBe('profile_fetch_failed')
})
test('an exact profile count carries no incomplete-source warning', async () => {
  jest.mocked(scraper.fetchProfile).mockResolvedValue(profile('100'))
  const result = await scrapeStats('fixture')
  expect(result.thisYearInfo.reason).toBeUndefined()
  expect(console.warn).not.toHaveBeenCalled()
})
