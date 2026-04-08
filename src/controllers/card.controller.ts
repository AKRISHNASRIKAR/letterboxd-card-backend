// Card controller
import { Request, Response, NextFunction } from "express"
import { scrapeStats }  from "../services/letterboxd"
import { renderCard }   from "../services/card/renderer"
import { getCached, setCached } from "../services/cache.service"
 
export async function getCard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, theme, width, count } = res.locals.params
 
    const statsKey = `stats:v3:${user}`
    let stats: Awaited<ReturnType<typeof scrapeStats>> | null =
      (await getCached(statsKey)) as Awaited<ReturnType<typeof scrapeStats>> | null
    if (!stats) {
      stats = await scrapeStats(user)
      await setCached(statsKey, stats, 3600)
    }
 
    const svg = await renderCard(stats, { user, theme, width: +width, count: +count })

    res.setHeader("Content-Type", "image/svg+xml")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    res.setHeader("X-Cache", stats ? "HIT" : "MISS")
    res.send(svg)
  } catch (err) {
    next(err)
  }
}