// src/server.ts
import express from "express"
import cors    from "cors"
import helmet  from "helmet"
import { rateLimitMiddleware } from "./middleware/rateLimit"
import { errorHandler }       from "./middleware/errorHandler"
import routes from "./routes"

const app = express()

// Production origins — strip any trailing slash from env var
const PROD_ORIGINS = [
  (process.env.FRONTEND_URL ?? "").replace(/\/+$/, ""),
  "https://letterboxd-card.vercel.app",
].filter(Boolean)

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors({
  origin: true, // Reflects the request origin, allowing all origins
  credentials: true,
}))
app.use(express.json())
app.use(rateLimitMiddleware)
app.use("/api", routes)
app.use(errorHandler)

export default app
