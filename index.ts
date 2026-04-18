import dotenv from "dotenv"
dotenv.config()
import express from "express"
import "express-async-errors"
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
import { getUserId } from "./utils"

const {
  APP_PORT = 80,
  OIDC_JWKS_URI,
  GROUP_MANAGER_API_URL = "UNDEFINED",
  USER_MANAGER_API_URL,
} = process.env

const promOptions = { includeMethod: true, includePath: true }

dbConnect()

const corsOptions = {
  exposedHeaders: TOTAL_HEADER,
}

const app = express()

app.use(express.json())
app.use(cors(corsOptions))
app.use(promBundle(promOptions))
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.get("/", (req: Request, res: Response) => {
  res.send({
    application_name: "Nenkyuu Calendar API",
    author,
    version,
    auth: {
      identification_url: USER_MANAGER_API_URL || "Unset",
      oidc_jwk_url: OIDC_JWKS_URI || "Unset",
    },
    group_manager_api_url: GROUP_MANAGER_API_URL,
    user_manager_api_url: USER_MANAGER_API_URL || "Unset",
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
  const method = req.method;
  const route = req.route?.path || "unknown route";

  const { user } = res.locals
  let current_user = getUserId(user)
  let { statusCode = 500, message = error } = error
  console.error(
    `${current_user} : [${method} | ${route}] Error: ${message}`
  );
  if (isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
})

// Export app for TDD
export default app

