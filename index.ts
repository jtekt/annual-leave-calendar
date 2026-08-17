import dotenv from "dotenv"
dotenv.config()
import express from "express"
import qs from "qs"
import cors from "cors"
import promBundle from "express-prom-bundle"
import { author, version } from "./package.json"
import {
  redactedConnectionString,
  connect as dbConnect,
  connected as dbConnected,
} from "./db"
import rootRouter from "./routes/index"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "./swagger-output.json"
import { Request, Response, NextFunction } from "express"
import { TOTAL_HEADER } from "./constants"
import { getUserIdFromUserObj } from "./utils"
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} from "./errors"

const {
  APP_PORT = 80,
  GROUP_MANAGER_API_URL = "UNDEFINED",
  USER_MANAGER_API_URL,
  IDENTIFICATION_URL,
  WORKPLACE_MANAGER_API_URL,
} = process.env

const promOptions = { includeMethod: true, includePath: true }

dbConnect()

const corsOptions = {
  exposedHeaders: TOTAL_HEADER,
}

const app = express()
app.set("query parser", (str: string) =>
  qs.parse(str, { arrayLimit: Infinity })
)

app.use(express.json())

// cors() should not be used for caldav
app.use((req, res, next) => {
  if (req.path.startsWith("/caldav")) return next()
  cors(corsOptions)(req, res, next)
})
app.use(promBundle(promOptions))
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.get("/", (_: Request, res: Response) => {
  res.send({
    application_name: "Nenkyuu Calendar API",
    author,
    version,
    auth: {
      identification_url: IDENTIFICATION_URL || "Unset",
    },
    group_manager_api_url: GROUP_MANAGER_API_URL,
    user_manager_api_url: USER_MANAGER_API_URL || "Unset",
    workplace_manager_api_url: WORKPLACE_MANAGER_API_URL || "Unset",
    mongodb: {
      url: redactedConnectionString,
      connected: dbConnected(),
    },
  })
})

app.use("/", rootRouter)

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  // Basic request info
  const method = req.method
  const route = req.route?.path || "unknown route"

  const { user } = res.locals
  let current_user = user ? getUserIdFromUserObj(user) : "anonymous"

  let statusCode: number
  if (error instanceof NotFoundError) statusCode = 404
  else if (error instanceof ValidationError) statusCode = 400
  else if (error instanceof UnauthorizedError) statusCode = 401
  else if (error instanceof ForbiddenError) statusCode = 403
  else statusCode = error.statusCode ?? 500

  if (isNaN(statusCode) || statusCode > 600) statusCode = 500

  const message = error.message ?? String(error)
  console.error(`${current_user} : [${method} | ${route}] Error: ${message}`)
  res.status(statusCode).send(message)
})

// Export app for TDD
export default app
