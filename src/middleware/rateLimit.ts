// Rate limit middleware
import rateLimit from "express-rate-limit"
 
export const rateLimitMiddleware = rateLimit({
  windowMs:       60 * 1000,   // 1 minute
  max:            30,           // 30 reqs per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests, slow down" }
})