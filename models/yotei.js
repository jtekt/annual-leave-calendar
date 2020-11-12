const mongoose = require('mongoose')

const yoteiSchema = new mongoose.Schema({
  date: Date,
  user_id: String,
  taken: Boolean,
  am: Boolean,
  pm: Boolean,
  refresh: Boolean,
  plus_one: Boolean,
},
{
  //collection: 'yoteis'
})

const Yotei = mongoose.model('yotei', yoteiSchema)

module.exports = Yotei
