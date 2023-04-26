import IEntry from "./entry"
interface IUser {
  _id?: string
  properties?: {
    _id: string
  }
  entries: IEntry[]
}

export default IUser
