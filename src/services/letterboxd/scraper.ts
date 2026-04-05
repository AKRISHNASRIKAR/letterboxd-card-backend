import pThrottle from "p-throttle"
import pRetry, { AbortError } from "p-retry"
 
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
]
 
const throttle = pThrottle({ limit: 2, interval: 1000 })
 
const rawFetch = (url: string) =>
  pRetry(
    async () => {
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const res = await fetch(url, { headers: { "User-Agent": ua } })
      if (res.status === 404) throw new AbortError("User not found")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    },
    { retries: 3, minTimeout: 600 }
  )
 
export const fetchProfile = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/`))
 
export const fetchFilms = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/films/`))
 
export const fetchLists = throttle((user: string) =>
  rawFetch(`https://letterboxd.com/${user}/lists/`))