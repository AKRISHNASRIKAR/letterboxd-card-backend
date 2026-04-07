// Validation middleware
import { Request, Response, NextFunction } from "express"
import { ZodSchema } from "zod"

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: result.error.flatten().fieldErrors
      })
    }
    // Express 5 makes req.query read-only, so store validated data in res.locals
    res.locals.params = result.data
    next()
  }
}