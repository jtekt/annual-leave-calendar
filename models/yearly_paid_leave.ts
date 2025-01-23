import { Schema, model } from "mongoose"
import IYearly_paid_leave from "../interfaces/yearly_paid_leave"

const schema = new Schema<IYearly_paid_leave>({
    year: { type: Number, required: true },
    user_id: { type: String, required: true },
    annual_paid_leave: {
      days_carried_over: { type: Number, default: false },
      days_granted: { type: Number, default: false },
     },
  })
  
  schema.index({ year: 1, user_id: 1 }, { unique: true })
  schema.index({ user_id: 1 })
  schema.index({ year: 1 })
  
  const Model = model("yearly_paid_leave", schema)
  
  export default Model
  