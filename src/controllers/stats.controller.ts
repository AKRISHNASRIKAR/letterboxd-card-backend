// Stats controller
import { Request, Response, NextFunction } from "express"
import { scrapeStats }         from "../services/letterboxd"
import { getCached, setCached, statsCacheKey, statsCacheTtl, isStatsCacheFresh } from "../services/cache.service"
import type { LetterboxdStats } from "../types/letterboxd"
 
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = res.locals.params
    const key    = statsCacheKey(user)
    const cached = await getCached<LetterboxdStats>(key)
    if (cached && isStatsCacheFresh(cached)) return res.json({ data: cached, cached: true })
 
    const stats = await scrapeStats(user)
    await setCached(key, stats, statsCacheTtl(stats))
    res.json({ data: stats, cached: false })
  } catch (err) {
    next(err)
  }
}
