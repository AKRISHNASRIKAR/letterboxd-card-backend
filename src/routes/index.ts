// src/routes/index.ts
import { Router } from "express"
import cardRouter  from "./card.route"
import statsRouter from "./stats.route"
import filmsRouter from "./films.route"
import listsRouter from "./lists.route"

const router = Router()
router.use("/card",  cardRouter)
router.use("/stats", statsRouter)
router.use("/films", filmsRouter)
router.use("/lists", listsRouter)
export default router
