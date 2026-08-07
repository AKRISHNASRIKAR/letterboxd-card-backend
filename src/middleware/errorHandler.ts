// Error handler middleware
import { Request, Response, NextFunction } from "express"
 
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[${req.method}] ${req.path}`, err.message, err.stack)
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
 
  if (err.name === "UserNotFoundError" || err.message.includes("User not found") || err.message.includes("404")) {
    return res.status(404).json({ error: "Letterboxd user not found" })
  }
  if (err.message.includes("429")) {
    return res.status(429).json({ error: "Rate limited upstream, try again shortly" })
  }
  // Cloudflare challenged every route we have. Surfacing this as 502 keeps a
  // blocked scrape from being mistaken for a real profile of all zeroes.
  if (err.name === "BlockedError") {
    return res.status(502).json({ error: "Letterboxd is currently blocking automated requests, try again shortly" })
  }
 
  res.status(500).json({ error: "Something went wrong" })
}