// src/routes/lists.route.ts
import { Router }            from "express"
import { getLists }          from "../controllers/lists.controller"
import { validate }          from "../middleware/validate"
import { listsParamsSchema } from "../validators/params"

const router = Router()
router.get("/", validate(listsParamsSchema), getLists)
export default router
