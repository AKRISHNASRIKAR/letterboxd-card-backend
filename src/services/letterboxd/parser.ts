import * as cheerio from "cheerio"
import { SELECTORS } from "./selectors"
 
const num = (s: string) => parseInt(s.replace(/,/g, "").trim()) || 0
 
export function parseProfile(html: string) {
  const $ = cheerio.load(html)
  return {
    username:    $(SELECTORS.username).text().trim(),
    displayName: $(SELECTORS.displayName).text().trim(),
    memberSince: $(SELECTORS.memberSince).first().text().trim(),
    avatar:      $(SELECTORS.avatar).attr("src") ?? "",
    totalFilms:  num($(SELECTORS.totalFilms).first().text()),
    thisYear:    num($(SELECTORS.thisYear).first().text()),
    following:   num($(SELECTORS.following).first().text()),
    followers:   num($(SELECTORS.followers).first().text()),
    lists:       num($(SELECTORS.lists).first().text()),
    recentFilms: $(SELECTORS.recentFilms).slice(0,8).map((_,el) => ({
      slug:   $(el).attr("data-film-slug") ?? "",
      name:   $(el).find(SELECTORS.filmName).attr("alt") ?? "",
      rating: $(el).find(SELECTORS.filmRating).text().trim(),
      year:   $(el).find(SELECTORS.filmYear).text().trim(),
    })).get()
  }
}