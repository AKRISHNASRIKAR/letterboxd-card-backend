export interface Film {
  slug:      string
  name:      string
  rating:    string
  year:      string
  posterUrl: string
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
  recentFilms: Film[]
  fetchedAt:   number
}
 
export interface CardParams {
  user:  string
  width: number
  count: number
}