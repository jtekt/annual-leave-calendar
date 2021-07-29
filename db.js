const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config()

const mongodb_url = process.env.MONGODB_URL || 'mongodb://mongo'
const mongodb_db = process.env.MONGODB_DB || 'nenkyuu_calendar'
const mongodb_options = {
   useUnifiedTopology: true,
   useNewUrlParser: true,
}

let mongodb_connected = false

mongoose.set('useCreateIndex', true)

function mongoose_connect(){
  console.log('[MongoDB] Attempting connection...')
  mongoose.connect(`${mongodb_url}/${mongodb_db}`, mongodb_options)
  .then(() => {console.log('[Mongoose] Initial connection successful')})
  .catch(error => {
    console.log('[Mongoose] Initial connection failed')
    setTimeout(mongoose_connect,5000)
  })
}

mongoose_connect()


const db = mongoose.connection
db.on('error', () => {
  console.log('[Mongoose] Connection lost')
  mongodb_connected = false
})
db.once('open', () => {
  console.log('[Mongoose] Connection established')
  mongodb_connected = true
})



exports.url = mongodb_url
exports.db = mongodb_db
exports.connected = () => mongodb_connected
