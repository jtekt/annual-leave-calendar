import { Schema, model } from "mongoose"
import IAllocation from "../interfaces/allocation"

const schema = new Schema<IAllocation>({
    year: { type: Number, required: true },
    user_id: { type: String, required: true },
    leaves: {
      current_year_grants: { type: Number, default: 0, required: true },
      carried_over: { type: Number, default: 0, required: true },
     },
     reserve: {
      current_year_grants: { type: Number, default: 0, required: true },
      carried_over: { type: Number, default: 0, required: true },
     },
  })
  
  schema.index({ year: 1, user_id: 1 }, { unique: true })
  schema.index({ user_id: 1 })
  schema.index({ year: 1 })
  
  const Model = model("allocation", schema)
  
  export default Model
  