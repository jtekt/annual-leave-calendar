const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')
const auth = require('@moreillon/authentication_middleware')

dotenv.config()

const app = express()

// provide express with the ability to read json request bodies
app.use(bodyParser.json())

// Authorize requests from different origins
app.use(cors())

// Use the authentication middleware
app.use(auth.authenticate)

const controller = require('./controllers/yotei.js')

const APP_PORT = process.env.APP_PORT || 80

app.get('/', (req, res) => {
  res.send({
    application_name: 'Nekyuu Calendar API',
    author: 'Maxime MOREILLON',
    version: pjson.version,
    authentication_api_url: process.env.AUTHENTICATION_API_URL,
    group_manager_api_url: process.env.GROUP_MANAGER_API_URL,
    mongodb_url: controller.mongodb_url,
    mongodb_db: controller.mongodb_db,
    mongodb_connected: mongodb_connected, // global
  })
})

app.route('/groups/:id/entries')
  .get(controller.get_entries_of_group)


app.route('/users/:id/entries')
  .get(controller.get_entries_of_user)
  .post(controller.create_entry)

app.route('/entries')
  .get(controller.get_all_entries)

app.route('/entries/:id')
  .get(controller.get_single_entry)
  .put(controller.update_entry)
  .delete(controller.delete_entry)


app.listen(APP_PORT, () => {
  console.log(`[Express] listening on port ${APP_PORT}`)
})
