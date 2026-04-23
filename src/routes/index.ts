// src/routes/index.ts
import { Router } from "express"
import cardRouter  from "./card.route"
import statsRouter from "./stats.route"
import filmsRouter from "./films.route"
import listsRouter from "./lists.route"

const router = Router()

router.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() })
})

router.use("/card",  cardRouter)
router.use("/stats", statsRouter)
router.use("/films", filmsRouter)
router.use("/lists", listsRouter)
export default router
