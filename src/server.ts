// src/server.ts
import express from "express"
import cors    from "cors"
import helmet  from "helmet"
import { rateLimitMiddleware } from "./middleware/rateLimit"
import { errorHandler }       from "./middleware/errorHandler"
import routes from "./routes"

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || "https://letterboxd-card.vercel.app" }))
app.use(express.json())
app.use(rateLimitMiddleware)
app.use("/api", routes)
app.use(errorHandler)

export default app
