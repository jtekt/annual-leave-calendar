import IEntry from "./entry"

interface IUser extends Record<string, any> {
  _id?: string
  properties?: Record<string, any> & {
    _id: string
  }
  entries: IEntry[]
}

export default IUser
