import { Schema, model } from "mongoose"
import IEntry from "../interfaces/entry"

const schema = new Schema<IEntry>({
  date: { type: Date, required: true },
  user_id: { type: String, required: true },
  comment: String,

  type: { type: String, required: true, default: "有休" }, // All day, morning or afternoon
  reserve: { type: Boolean, default: false }, // This is the flag for determining the use of reserved annual leave.

  refresh: { type: Boolean, default: false },

  // Those are probably not used anymore
  taken: { type: Boolean, default: false },
  plus_one: { type: Boolean, default: false },
})

schema.index({ date: 1, user_id: 1 }, { unique: true })
schema.index({ user_id: 1 })
schema.index({ date: 1 })

const Model = model("yotei", schema)

export default Model
