// src/routes/stats.route.ts
import { Router }            from "express"
import { getStats }          from "../controllers/stats.controller"
import { validate }          from "../middleware/validate"
import { statsParamsSchema } from "../validators/params"

const router = Router()
router.get("/", validate(statsParamsSchema), getStats)
export default router
