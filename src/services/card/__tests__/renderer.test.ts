import { renderCard } from '../renderer'
import { emptyProfile } from '../../letterboxd/parser'
import { transform } from '../../letterboxd/transformer'

test('a card with no remote images renders with bundled fonts and no HTTP requests', async () => {
  const originalFetch = global.fetch
  const httpRequests: string[] = []
  const spy = jest.spyOn(global, 'fetch').mockImplementation((...args) => {
    if (/^https?:/.test(String(args[0]))) httpRequests.push(String(args[0]))
    return originalFetch(...args)
  })
  try {
    const result = await renderCard(transform(emptyProfile()), 4)
    expect(result.toString()).toMatch(/^<svg/)
    expect(httpRequests).toEqual([])
  } finally {
    spy.mockRestore()
  }
})
