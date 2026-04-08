import * as cheerio from "cheerio"
import { SELECTORS } from "./selectors"

const num = (s: string) => parseInt(s.replace(/,/g, "").trim()) || 0

export function parseProfile(html: string) {
  const $ = cheerio.load(html)

  const recentFilms = $(SELECTORS.recentFilms).slice(0, 8).map((_, el) => {
    const rawName  = $(el).attr("data-item-name") ?? ""
    const yearMatch = rawName.match(/\((\d{4})\)$/)
    const year      = yearMatch ? yearMatch[1] : ""
    const name      = rawName.replace(/\s*\(\d{4}\)$/, "").trim()
    const slug      = $(el).attr("data-item-slug") ?? ""
    const filmId    = $(el).attr("data-film-id") ?? ""
    const rating    = $(el).closest(".griditem").find(SELECTORS.filmRating).first().text().trim()
    return { slug, name, rating, year, filmId }
  }).get()

  return {
    username:    $(SELECTORS.username).attr("title") ?? "",
    displayName: $(SELECTORS.displayName).text().trim(),
    memberSince: $(SELECTORS.memberSince).first().text().trim(),
    avatar:      $(SELECTORS.avatar).first().attr("src") ?? "",
    totalFilms:  num($(SELECTORS.totalFilms).first().text()),
    thisYear:    num($(SELECTORS.thisYear).first().text()),
    following:   num($(SELECTORS.following).first().text()),
    followers:   num($(SELECTORS.followers).first().text()),
    lists:       num($(SELECTORS.lists).first().text()),
    recentFilms,
  }
}
