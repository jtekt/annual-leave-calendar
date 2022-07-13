const express = require('express')
const cors = require('cors')
const apiMetrics = require('prometheus-api-metrics')
const dotenv = require('dotenv')
const {author, version} = require('./package.json')
const auth = require('@moreillon/express_identification_middleware')
const db = require('./db.js')
const entries_router = require('./routes/entries.js')
const {
  get_entries_of_group,
  get_entries_of_user,
  create_entry,
} = require('./controllers/entries.js')

dotenv.config()


const {
  APP_PORT = 80,
  IDENTIFICATION_URL,
  GROUP_MANAGER_API_URL = 'UNDEFINED',
} = process.env


const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())


app.get('/', (req, res) => {
  res.send({
    application_name: 'Nenkyuu Calendar API',
    author,
    version,
    auth: {
      identification_url: IDENTIFICATION_URL || 'Unset',
    },
    group_manager_api_url: GROUP_MANAGER_API_URL,
    mongodb: {
      url: db.url,
      db: db.db,
      connected: db.connected(),
    }

  })
})

// Authenticate everything from here on
if (IDENTIFICATION_URL) {
  const auth_options = { url: IDENTIFICATION_URL }
  app.use(auth(auth_options))
}


app.route('/groups/:group_id/entries')
  .get(get_entries_of_group)

app.route('/users/:user_id/entries')
  .get(get_entries_of_user)
  .post(create_entry)

app.use('/entries', entries_router)

app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})

// Export app for TDD
module.exports = app
