import { Request, Response, NextFunction } from "express"
import { getProfileStats } from "../services/profile.service"

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = res.locals.params
    const { stats, cacheHit } = await getProfileStats(user)
    res.json({ data: stats, cached: cacheHit })
  } catch (err) {
    next(err)
  }
}
