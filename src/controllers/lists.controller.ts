// src/controllers/lists.controller.ts
import { Request, Response, NextFunction } from "express"
import { fetchLists }          from "../services/letterboxd"
import { parseListsPage }      from "../services/letterboxd/parser"
import { getCached, setCached } from "../services/cache.service"

export async function getLists(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = res.locals.params
    const key    = `lists:v2:${user}`
    const cached = await getCached(key)
    if (cached) return res.json({ data: cached, cached: true })

    const { lists } = parseListsPage(await fetchLists(user))

    await setCached(key, lists, 3600)
    res.json({ data: lists, cached: false })
  } catch (err) {
    next(err)
  }
}
