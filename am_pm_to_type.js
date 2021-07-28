const Yotei = require('./models/yotei.js')
const dotenv = require('dotenv')
const mongoose = require('mongoose')

dotenv.config()

const mongodb_url = process.env.MONGODB_URL ?? 'mongodb://mongo'
const mongodb_db = process.env.MONGODB_DB ??'nenkyuu_calendar'
const mongodb_options = {
   useUnifiedTopology: true,
   useNewUrlParser: true,
}

global.mongodb_connected = false

mongoose.connect(`${mongodb_url}/${mongodb_db}`, mongodb_options)

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {
  Yotei.find({})
  .then(results => {
    results.forEach((result) => {
      const {am, pm} = result
      if(am && !pm) result.type = "前半休"
      else if(!am && pm) result.type = "後半休"
      else result.type = "有休"
      //console.log(result)
      result.save()
      .then(() => {console.log(`OK`)})
      .catch(console.log)
    })


  })
  .catch(console.log)
})
