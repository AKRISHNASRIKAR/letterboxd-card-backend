// Error handler middleware
import { Request, Response, NextFunction } from "express"
 
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[${req.method}] ${req.path}`, err.message, err.stack)
 
  if (err.message.includes("User not found") || err.message.includes("404")) {
    return res.status(404).json({ error: "Letterboxd user not found" })
  }
  if (err.message.includes("429")) {
    return res.status(429).json({ error: "Rate limited upstream, try again shortly" })
  }
 
  res.status(500).json({ error: "Something went wrong", debug: { message: err.message, name: err.name, stack: err.stack } })
}