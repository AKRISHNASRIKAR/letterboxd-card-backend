// src/server.ts
import express from "express"
import cors    from "cors"
import helmet  from "helmet"
import { rateLimitMiddleware } from "./middleware/rateLimit"
import { errorHandler }       from "./middleware/errorHandler"
import routes from "./routes"

const app = express()

// Allow listed origins: production frontend + localhost for dev
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "https://letterboxd-card.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[]

app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(rateLimitMiddleware)
app.use("/api", routes)
app.use(errorHandler)

export default app
