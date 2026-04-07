// src/controllers/films.controller.ts
import { Request, Response, NextFunction } from "express"
import { fetchFilms }           from "../services/letterboxd"
import { getCached, setCached }  from "../services/cache.service"
import * as cheerio from "cheerio"
import { SELECTORS } from "../services/letterboxd/selectors"

export async function getFilms(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, count } = res.locals.params
    const key    = `films:${user}`
    const cached = await getCached(key)
    if (cached) return res.json({ data: cached, cached: true })

    const html = await fetchFilms(user)
    const $ = cheerio.load(html)

    const films = $(SELECTORS.recentFilms).slice(0, +count).map((_, el) => {
      const rawName   = $(el).attr("data-item-name") ?? ""
      const yearMatch = rawName.match(/\((\d{4})\)$/)
      const year      = yearMatch ? yearMatch[1] : ""
      const name      = rawName.replace(/\s*\(\d{4}\)$/, "").trim()
      const slug      = $(el).attr("data-item-slug") ?? ""
      const rating    = $(el).closest(".griditem").find(SELECTORS.filmRating).first().text().trim()
      return { slug, name, rating, year }
    }).get()

    await setCached(key, films, 3600)
    res.json({ data: films, cached: false })
  } catch (err) {
    next(err)
  }
}
