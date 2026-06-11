import createHttpError from "http-errors"
import IUser from "./interfaces/user"
import axios from "axios"

const { USER_MANAGER_API_URL } = process.env
export const getUserId = (user?: IUser): string => {
  const id = user?._id || user?.properties?._id
  if (!id) {
    throw createHttpError(401, "User ID not found")
  }
  return id
}

export const collectByKeys = <T>(
  list: T[],
  getKeys: (item: T) => (string | undefined)[],
  accumulate: (acc: Record<string, any>, item: T, key: string) => void,
  initial: Record<string, any> = {}
) =>
  list.reduce((acc, item) => {
    for (const key of getKeys(item).filter(Boolean) as string[]) {
      accumulate(acc, item, key)
    }
    return acc
  }, initial)

export const fetchUserData = async (
  user_id: string,
  authorization?: string
) => {
  try {
    const headers: Record<string, string> = {}
    if (authorization?.trim()) headers.Authorization = authorization
    const res = await axios.get(`${USER_MANAGER_API_URL}/v3/users/${user_id}`, {
      headers,
    })
    return res.data
  } catch (error: any) {
    const status = error?.response?.status ?? 500
    const code = error?.code
    if (status === 403 || status === 401) {
      throw createHttpError(403, "Unauthorized to access USER_MANAGER_API")
    } else if (status === 404) {
      throw createHttpError(404, "User not found in USER_MANAGER_API")
    } else if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
      throw createHttpError(502, "USER_MANAGER_API is unreachable")
    } else {
      throw createHttpError(400, "Failed to fetch from USER_MANAGER_API")
    }
  }
}
