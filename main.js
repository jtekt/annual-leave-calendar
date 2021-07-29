const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')
const auth = require('@moreillon/authentication_middleware')
const db = require('./db.js')
const controller = require('./controllers/yotei.js')

dotenv.config()

const APP_PORT = process.env.APP_PORT || 80


const app = express()

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// Authorize requests from different origins
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name: 'Nekyuu Calendar API',
    author: 'Maxime MOREILLON',
    version: pjson.version,
    authentication_api_url: process.env.AUTHENTICATION_API_URL || 'UNDEFINED',
    group_manager_api_url: process.env.GROUP_MANAGER_API_URL || 'UNDEFINED',
    mongodb_url: db.url,
    mongodb_db: db.db,
    mongodb_connected: db.connected(),
  })
})

app.route('/groups/:id/entries')
  .get(auth.authenticate, controller.get_entries_of_group)


app.route('/users/:id/entries')
  .get(auth.authenticate, controller.get_entries_of_user)
  .post(auth.authenticate, controller.create_entry)

app.route('/entries')
  .get(auth.authenticate, controller.get_all_entries)

app.route('/entries/:id')
  .get(auth.authenticate, controller.get_single_entry)
  .put(auth.authenticate, controller.update_entry)
  .delete(auth.authenticate, controller.delete_entry)


app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})
