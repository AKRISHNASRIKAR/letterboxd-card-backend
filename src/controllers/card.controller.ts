import { Request, Response, NextFunction } from "express"
import { performance } from "node:perf_hooks"
import { getProfileStats } from "../services/profile.service"
import { getRenderedCard } from "../services/card/cache"

export async function getCard(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, count } = res.locals.params
    const start = performance.now()
    const { stats, cacheHit } = await getProfileStats(user)
    const profileMs = performance.now() - start
    const renderStart = performance.now()
    const card = await getRenderedCard(stats, +count)

    res.setHeader("Content-Type", "image/svg+xml")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    res.setHeader("Cache-Control", stats.thisYearInfo.accuracy === "exact"
      ? "s-maxage=3600, stale-while-revalidate=86400"
      : "max-age=0, s-maxage=60, must-revalidate")
    res.setHeader("X-Cache", cacheHit ? "HIT" : "MISS")
    res.setHeader("X-Card-Cache", card.cacheHit ? "HIT" : "MISS")
    res.setHeader("Server-Timing", `profile;dur=${profileMs.toFixed(1)}, card;dur=${(performance.now() - renderStart).toFixed(1)}`)
    res.send(card.svg)
  } catch (err) {
    next(err)
  }
}
