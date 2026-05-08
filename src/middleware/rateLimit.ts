// Rate limit middleware
import rateLimit from "express-rate-limit"
 
export const rateLimitMiddleware = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  validate:        { xForwardedForHeader: false },
  message: { error: "Too many requests, slow down" },
})