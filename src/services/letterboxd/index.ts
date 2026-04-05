import { fetchProfile } from "./scraper"
import { parseProfile } from "./parser"
import { transform }    from "./transformer"
 
export async function scrapeStats(username: string) {
  const html = await fetchProfile(username)
  const raw  = parseProfile(html)
  return transform(raw)
}
 
export { fetchProfile, fetchFilms, fetchLists } from "./scraper"
export { parseProfile }                          from "./parser"