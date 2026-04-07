// Card routes
import { Router }          from "express"
import { getCard }         from "../controllers/card.controller"
import { validate }        from "../middleware/validate"
import { cardParamsSchema } from "../validators/params"
 
const router = Router()
router.get("/", validate(cardParamsSchema), getCard)
export default router