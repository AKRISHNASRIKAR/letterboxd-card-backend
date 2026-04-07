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

app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    // No origin = curl / Postman / server-to-server — always allow
    if (!origin) return cb(null, true)
    // Allow every localhost port for local dev (3000, 3001, 3002, …)
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
    // Allow configured production frontend URLs
    if (PROD_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(rateLimitMiddleware)
app.use("/api", routes)
app.use(errorHandler)

export default app
