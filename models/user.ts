import { Schema, model, Document } from "mongoose"

interface IUserDoc extends Document {
  user_id: string
  properties?: Record<string, any>
}

const schema = new Schema<IUserDoc>({
  user_id: { type: String, required: true, unique: true },
  properties: { type: Schema.Types.Mixed },
})

const UserModel = model<IUserDoc>("user", schema)
export default UserModel
