import { Schema, model } from "mongoose"
import IAllocation from "../interfaces/allocation"

const schema = new Schema<IAllocation>({
  year: { type: Number, required: true },
  user_id: { type: String },
  preferred_username: { type: String },
  leaves: {
    current_year_grants: { type: Number, default: 0, required: true },
    carried_over: { type: Number, default: 0, required: true },
  },
  reserve: {
    current_year_grants: { type: Number, default: 0, required: true },
    carried_over: { type: Number, default: 0, required: true },
  },
})

// Unique when user_id exists
schema.index(
  { date: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $exists: true } } }
);

// Unique when preferred_username exists
schema.index(
  { date: 1, preferred_username: 1 },
  { unique: true, partialFilterExpression: { preferred_username: { $exists: true } } }
);
schema.index({ user_id: 1 })
schema.index({ preferred_username: 1 })
schema.index({ year: 1 })

const Model = model("allocations", schema)

export default Model
