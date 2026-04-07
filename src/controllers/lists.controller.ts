// src/controllers/lists.controller.ts
import { Request, Response, NextFunction } from "express"
import { fetchLists }          from "../services/letterboxd"
import { getCached, setCached } from "../services/cache.service"
import * as cheerio from "cheerio"

export async function getLists(req: Request, res: Response, next: NextFunction) {
  try {
    const { user } = res.locals.params
    const key    = `lists:${user}`
    const cached = await getCached(key)
    if (cached) return res.json({ data: cached, cached: true })

    const html = await fetchLists(user)
    const $ = cheerio.load(html)

    const lists = $(".list-set .list-link").map((_, el) => ({
      title:      $(el).find("h2").text().trim(),
      url:        $(el).attr("href") ?? "",
      filmCount:  parseInt($(el).find(".value").text().replace(/,/g, "").trim()) || 0,
    })).get()

    await setCached(key, lists, 3600)
    res.json({ data: lists, cached: false })
  } catch (err) {
    next(err)
  }
}
