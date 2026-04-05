import express from "express"
import cors    from "cors"
import helmet  from "helmet"
//import routes from "./routes"

const app = express()
 
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())
//app.use("/api", routes)

 
export default app