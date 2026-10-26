import { getProfileStats } from '../profile.service'
import { getCached, setCached } from '../cache.service'
import { scrapeStats } from '../letterboxd'
import { emptyProfile } from '../letterboxd/parser'
import { transform } from '../letterboxd/transformer'

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }))
jest.mock('../cache.service', () => ({
  ...jest.requireActual('../cache.service'), getCached: jest.fn(), setCached: jest.fn(),
}))
jest.mock('../letterboxd', () => ({ scrapeStats: jest.fn() }))

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(getCached).mockResolvedValue(null)
  jest.mocked(setCached).mockResolvedValue()
  jest.mocked(scrapeStats).mockImplementation(async () => transform(emptyProfile()))
})
test('simultaneous JSON and image requests share one scrape', async () => {
  const [a, b] = await Promise.all([getProfileStats('fixture'), getProfileStats('fixture')])
  expect(a.stats).toBe(b.stats)
  expect(scrapeStats).toHaveBeenCalledTimes(1)
  expect(getCached).toHaveBeenCalledTimes(1)
})
test('different users never share profile data', async () => {
  await Promise.all([getProfileStats('first'), getProfileStats('second')])
  expect(scrapeStats).toHaveBeenCalledWith('first')
  expect(scrapeStats).toHaveBeenCalledWith('second')
  expect(scrapeStats).toHaveBeenCalledTimes(2)
})
test('a failed scrape is removed so retry can succeed', async () => {
  jest.mocked(scrapeStats).mockRejectedValueOnce(new Error('blocked'))
  await expect(getProfileStats('fixture')).rejects.toThrow('blocked')
  await expect(getProfileStats('fixture')).resolves.toHaveProperty('cacheHit', false)
  expect(scrapeStats).toHaveBeenCalledTimes(2)
})
