import dotenv from "dotenv"
dotenv.config()
import express from "express"
import "express-async-errors"
import cors from "cors"
import promBundle from "express-prom-bundle"
import { author, version } from "./package.json"
import auth from "@moreillon/express_identification_middleware"
import {
  redactedConnectionString,
  connect as dbConnect,
  connected as dbConnected,
} from "./db"
import rootRouter from "./routes/index"
// import {
//   get_entries_of_group,
//   get_entries_of_workplace,
// } from "./controllers/v1/entries"
// import { get_entries_of_user_v2 } from "./controllers/v2/entries"
// import {
//   get_allocations_of_user,
//   get_allocations_of_group,
//   create_allocation,
// } from "./controllers/v1/allocations"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "./swagger-output.json"
import { Request, Response, NextFunction } from "express"
import { TOTAL_HEADER } from "./constants"

const {
  APP_PORT = 80,
  IDENTIFICATION_URL,
  GROUP_MANAGER_API_URL = "UNDEFINED",
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
      identification_url: IDENTIFICATION_URL || "Unset",
    },
    group_manager_api_url: GROUP_MANAGER_API_URL,
    mongodb: {
      url: redactedConnectionString,
      connected: dbConnected(),
    },
  })
})

// Authenticate everything from here on
if (IDENTIFICATION_URL) {
  const auth_options = { url: IDENTIFICATION_URL }
  app.use(auth(auth_options))
}

// app.route("/groups/:group_id/entries").get(get_entries_of_group)

// app.route("/groups/:group_id/allocations").get(get_allocations_of_group)

// app.route("/workplaces/:workplace_id/entries").get(get_entries_of_workplace)

// app.route("/users/:user_id/entries").get(get_entries_of_user).post(create_entry)

// app.route("/v2/users/:user_id/entries").get(get_entries_of_user_v2)

// app
//   .route("/users/:user_id/allocations")
//   .get(get_allocations_of_user)
//   .post(create_allocation)

// app.use("/entries", entries_router_v1)

// app.use("/allocatons", allocatons_router)

app.use("/", rootRouter)

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error(error)
  let { statusCode = 500, message = error } = error
  if (isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
})

// Export app for TDD
export default app
