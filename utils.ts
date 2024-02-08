import IUser from "./interfaces/user"
import IEntry from "./interfaces/entry"

export const getUserId = (user: IUser) => user._id || user.properties?._id

export const getUsersEntries = (entries: any[], users: any[]) => {
  const entries_mapping = entries.reduce((prev: any, entry: IEntry) => {
    const { user_id } = entry
    if (!prev[user_id]) prev[user_id] = []
    prev[user_id].push(entry)
    return prev
  }, {})

  const output = users.map((user: IUser) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const entries = entries_mapping[user_id] || []
    // FIXME: Two formats?
    user.entries = entries
    return { user, entries }
  })
  return output
}

export const getDates = (
  start_date: string,
  end_date: string,
  year: number
) => {
  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  return { start_of_date, end_of_date }
}
