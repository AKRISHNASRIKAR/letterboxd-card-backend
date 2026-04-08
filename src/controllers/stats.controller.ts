// Stats controller
import { Request, Response, NextFunction } from "express"
import { scrapeStats }         from "../services/letterboxd"
import { getCached, setCached } from "../services/cache.service"
 
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = res.locals.params
    const key    = `stats:v3:${user}`
    const cached = await getCached(key)
    if (cached) return res.json({ data: cached, cached: true })
 
    const stats = await scrapeStats(user)
    await setCached(key, stats, 3600)
    res.json({ data: stats, cached: false })
  } catch (err) {
    next(err)
  }
}