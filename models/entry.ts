import {Schema, model} from 'mongoose'

const schema = new Schema({
  date: {type: Date, required: true},
  user_id: {type: String, required: true},
  comment: String,

  taken: {type: Boolean, default: false},
  type: {type: String, required: true, default: '有休'}, // All day, morning or afternoon

  refresh: {type: Boolean, default: false},
  plus_one: {type: Boolean, default: false},

})

schema.index({ date: 1, user_id: 1 }, { unique: true })


const Model = model('yotei', schema)

export default Model