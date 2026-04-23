import pThrottle from "p-throttle"
import pRetry, { AbortError } from "p-retry"
 
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
]
 
const throttle = pThrottle({ limit: 2, interval: 1000 })
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
 
const rawFetch = (url: string) =>
  pRetry(
    async () => {
      await delay(200 + Math.random() * 400)
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0"
      }
      
      try {
        const res = await fetch(url, { headers })
        if (res.status === 404) throw new AbortError("User not found")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.text()
      } catch (err) {
        if (err instanceof AbortError) throw err
        
        try {
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { headers })
          if (res.status === 404) throw new AbortError("User not found")
          if (res.ok) return await res.text()
        } catch (e) {
          if (e instanceof AbortError) throw e
        }

        try {
          const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { headers })
          if (res.status === 404) throw new AbortError("User not found")
          if (res.ok) return await res.text()
        } catch (e) {
          if (e instanceof AbortError) throw e
        }

        throw err
      }
    },
    { retries: 3, minTimeout: 800 }
  )
 
export const fetchProfile = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/`))
 
export const fetchFilms = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/films/`))
 
export const fetchLists = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/lists/`))