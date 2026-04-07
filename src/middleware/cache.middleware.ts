// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from "express"
import { getCached, setCached } from "../services/cache.service"

export function cacheMiddleware(prefix: string, ttl = 3600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.query.user as string
    if (!user) return next()

    const key = `${prefix}:${user}`
    const cached = await getCached(key)

    if (cached) {
      return res.json({ data: cached, cached: true })
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res)
    res.json = ((body: any) => {
      if (body?.data) {
        setCached(key, body.data, ttl).catch(() => {})
      }
      return originalJson(body)
    }) as any

    next()
  }
}
