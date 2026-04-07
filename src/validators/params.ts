// Params validator
import { z } from "zod"
 
const username = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid Letterboxd username")
 
export const cardParamsSchema = z.object({
  user:  username,
  theme: z.enum(["default","dark","minimal"]).default("default"),
  width: z.coerce.number().min(300).max(800).default(480),
  count: z.coerce.number().min(1).max(8).default(4),
})
 
export const statsParamsSchema = z.object({ user: username })
 
export const filmsParamsSchema = z.object({
  user:  username,
  count: z.coerce.number().min(1).max(20).default(8),
})
 
export const listsParamsSchema = z.object({ user: username })