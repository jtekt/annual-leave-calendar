const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config()

const {
  MONGODB_URL = 'mongodb://mongo',
  MONGODB_DB = 'nenkyuu_calendar'
} = process.env


const mongodb_options = {
   useUnifiedTopology: true,
   useNewUrlParser: true,
}

mongoose.set('useCreateIndex', true)

const connect = () => {

  const connection_string = `${MONGODB_URL}/${MONGODB_DB}`
  console.log(`[MongoDB] Attempting connection to ${connection_string}`)

  mongoose.connect(connection_string, mongodb_options)
    .then(() => { console.log('[Mongoose] Initial connection successful') })
    .catch(error => {
      console.log('[Mongoose] Initial connection failed, retrying...')
      setTimeout(connect, 5000)
    })

}



exports.url = MONGODB_URL
exports.db = MONGODB_DB
exports.connected = () => mongoose.connection.readyState
exports.connect = connect
