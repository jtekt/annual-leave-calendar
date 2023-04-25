import dotenv from "dotenv"
dotenv.config()
import express from "express"
import "express-async-errors"
import cors from "cors"
import apiMetrics from "prometheus-api-metrics"
import { author, version } from "./package.json"
import auth from "@moreillon/express_identification_middleware"
import {MONGODB_URL, MONGODB_DB, connect as dbConnect, connected as dbConnected} from "./db"
import entries_router from "./routes/entries"
import {
  get_entries_of_group,
  get_entries_of_user,
  create_entry,
} from "./controllers/entries"

import { Request, Response } from "express"


const {
  APP_PORT = 80,
  IDENTIFICATION_URL,
  GROUP_MANAGER_API_URL = "UNDEFINED",
} = process.env

dbConnect()

const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())

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
      url: MONGODB_URL,
      db: MONGODB_DB,
      connected: dbConnected(),
    },
  })
})

// Authenticate everything from here on
if (IDENTIFICATION_URL) {
  const auth_options = { url: IDENTIFICATION_URL }
  app.use(auth(auth_options))
}

app.route("/groups/:group_id/entries").get(get_entries_of_group)

app.route("/users/:user_id/entries").get(get_entries_of_user).post(create_entry)

app.use("/entries", entries_router)

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})

// Export app for TDD
export default app
