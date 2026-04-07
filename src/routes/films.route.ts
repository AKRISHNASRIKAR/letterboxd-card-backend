// src/routes/films.route.ts
import { Router }            from "express"
import { getFilms }          from "../controllers/films.controller"
import { validate }          from "../middleware/validate"
import { filmsParamsSchema } from "../validators/params"

const router = Router()
router.get("/", validate(filmsParamsSchema), getFilms)
export default router
