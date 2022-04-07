const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const {author, version} = require('./package.json')
const auth = require('@moreillon/authentication_middleware')
const db = require('./db.js')
const controller = require('./controllers/yotei.js')
const entries_router = require('./routes/entries.js')

dotenv.config()


const {
  APP_PORT = 80,
  AUTHENTICATION_API_URL = 'UNDEFINED',
  GROUP_MANAGER_API_URL = 'UNDEFINED',
} = process.env


const app = express()

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// Authorize requests from different origins
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name: 'Nenkyuu Calendar API',
    author,
    version,
    authentication_api_url: AUTHENTICATION_API_URL,
    group_manager_api_url: GROUP_MANAGER_API_URL,
    mongodb: {
      url: db.url,
      db: db.db,
      connected: db.connected(),
    }

  })
})

// Authenticate everything from here on
app.use(auth.authenticate)

app.route('/groups/:group_id/entries')
  .get(controller.get_entries_of_group)

app.route('/users/:user_id/entries')
  .get(controller.get_entries_of_user)
  .post( controller.create_entry)

app.use('/entries', entries_router)



app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})

// Export app for TDD
module.exports = app
