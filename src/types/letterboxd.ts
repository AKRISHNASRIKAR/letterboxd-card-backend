export interface Film {
  slug:      string
  name:      string
  rating:    string
  year:      string
  posterUrl: string
}
 
export interface YearCountInfo {
  year: number
  accuracy: "exact" | "lower_bound" | "unavailable"
  source: "profile" | "rss" | null
  reason?: "profile_blocked" | "profile_fetch_failed" | "profile_count_missing"
}

export interface LetterboxdStats {
  username:    string
  displayName: string
  memberSince: string
  avatar:      string
  stats: {
    totalFilms: number
    thisYear:   number
    following:  number
    followers:  number
    lists:      number
  }
  thisYearInfo: YearCountInfo
  recentFilms: Film[]
  fetchedAt:   number
}
 
export interface CardParams {
  user:  string
  width: number
  count: number
}
