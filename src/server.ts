// src/server.ts
import express from "express"
import cors    from "cors"
import helmet  from "helmet"
import { rateLimitMiddleware } from "./middleware/rateLimit"
import { errorHandler }       from "./middleware/errorHandler"
import routes from "./routes"

const app = express()

// Trust Vercel's proxy so X-Forwarded-For is used for rate limiting
app.set("trust proxy", 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(express.json())
app.use(rateLimitMiddleware)

app.get("/", (_req, res) => {
  res.json({
    name: "letterboxd-card-backend",
    status: "ok",
    endpoints: ["/api/stats", "/api/card", "/api/films", "/api/lists", "/api/health"],
  })
})

app.use("/api", routes)
app.use(errorHandler)

export default app
