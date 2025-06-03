interface IEntry {
  _id: string // Shouldn't be ObjectID?
  date: Date
  user_id: string
  preferred_username: string
  comment: string
  type: string
  reserve: boolean
  refresh: boolean
  taken?: boolean
  plus_one?: boolean
}

export default IEntry
