const {Schema, model} = require('mongoose')

const schema = new Schema({
  date: Date,
  user_id: String,

  taken: Boolean,
  type: String,

  am: Boolean, // Legacy
  pm: Boolean, // Legacy

  refresh: Boolean,
  plus_one: Boolean,

})

schema.index({ date: 1, user_id: 1 }, { unique: true })


const Model = model('yotei', schema)

module.exports = Model
