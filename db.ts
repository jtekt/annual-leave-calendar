import mongoose from "mongoose"

export const {
  MONGODB_CONNECTION_STRING,
  MONGODB_PROTOCOL = "mongodb",
  MONGODB_USERNAME,
  MONGODB_PASSWORD,
  MONGODB_HOST = "localhost",
  MONGODB_PORT,
  MONGODB_DB = "nenkyuu_calendar",
  MONGODB_OPTIONS = "",
} = process.env

const mongodbPort = MONGODB_PORT ? `:${MONGODB_PORT}` : ""

const connectionString =
  MONGODB_CONNECTION_STRING ||
  (MONGODB_USERNAME && MONGODB_PASSWORD
    ? `${MONGODB_PROTOCOL}://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}${mongodbPort}/${MONGODB_DB}${MONGODB_OPTIONS}`
    : `${MONGODB_PROTOCOL}://${MONGODB_HOST}${mongodbPort}/${MONGODB_DB}${MONGODB_OPTIONS}`)

export const redactedConnectionString = connectionString.replace(
  /:.*@/,
  "://***:***@"
)

const mongodb_options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
}

mongoose.set("useCreateIndex", true)

export const connect = () => {
  console.log(`[MongoDB] Attempting connection to ${redactedConnectionString}`)

  mongoose
    .connect(connectionString, mongodb_options)
    .then(() => {
      console.log("[Mongoose] Initial connection successful")
    })
    .catch((error: Error) => {
      console.log("[Mongoose] Initial connection failed, retrying...")
      console.error(error)
      setTimeout(connect, 5000)
    })
}

export const connected = () => mongoose.connection.readyState
