const {Schema, model} = require('mongoose')

const yoteiSchema = new Schema({
  date: Date,
  user_id: String,

  taken: Boolean,
  am: Boolean,
  pm: Boolean,

  refresh: Boolean,
  plus_one: Boolean,

  type: String,
},
{
  //collection: 'yoteis'
})

yoteiSchema.index({ date: 1, user_id: 1 }, { unique: true })


const Yotei = model('yotei', yoteiSchema)

module.exports = Yotei
