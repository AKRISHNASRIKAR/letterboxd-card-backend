// src/controllers/films.controller.ts
import { Request, Response, NextFunction } from "express"
import { fetchRss }             from "../services/letterboxd"
import { parseRss }             from "../services/letterboxd/parser"
import { getCached, setCached }  from "../services/cache.service"

export async function getFilms(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, count } = res.locals.params
    const key    = `films:v2:${user}`
    const cached = await getCached(key)
    if (cached) return res.json({ data: cached, cached: true })

    // Sourced from the RSS feed rather than the /films/ grid: the grid is ordered
    // by release date and carries no watch dates, so it can't answer "recent".
    const feed = parseRss(await fetchRss(user))

    const films = feed.entries.slice(0, +count).map(e => ({
      slug: e.slug, name: e.name, rating: e.rating, year: e.year,
      watchedDate: e.watchedDate, posterUrl: e.posterUrl,
    }))

    await setCached(key, films, 3600)
    res.json({ data: films, cached: false })
  } catch (err) {
    next(err)
  }
}
