// src/controllers/films.controller.ts
import { Request, Response, NextFunction } from "express"
import { fetchFilms }          from "../services/letterboxd"
import { parseProfile }        from "../services/letterboxd"
import { getCached, setCached } from "../services/cache.service"
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

    const films = $(SELECTORS.recentFilms).slice(0, +count).map((_, el) => ({
      slug:   $(el).attr("data-film-slug") ?? "",
      name:   $(el).find(SELECTORS.filmName).attr("alt") ?? "",
      rating: $(el).find(SELECTORS.filmRating).text().trim(),
      year:   $(el).find(SELECTORS.filmYear).text().trim(),
    })).get()

    await setCached(key, films, 3600)
    res.json({ data: films, cached: false })
  } catch (err) {
    next(err)
  }
}
