const mongoose = require('mongoose')


export const {
  MONGODB_URL = 'mongodb://mongo',
  MONGODB_DB = 'nenkyuu_calendar'
} = process.env


const mongodb_options = {
   useUnifiedTopology: true,
   useNewUrlParser: true,
}

mongoose.set('useCreateIndex', true)

export const connect = () => {

  const connection_string = `${MONGODB_URL}/${MONGODB_DB}`
  console.log(`[MongoDB] Attempting connection to ${connection_string}`)

  mongoose.connect(connection_string, mongodb_options)
    .then(() => { console.log('[Mongoose] Initial connection successful') })
    .catch((error: Error) => {
      console.log('[Mongoose] Initial connection failed, retrying...')
      console.error(error)
      setTimeout(connect, 5000)
    })

}



export const connected = () => mongoose.connection.readyState
