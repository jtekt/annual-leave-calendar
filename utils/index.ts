import createHttpError from "http-errors"
import IUser from "../interfaces/user"
import axios from "axios"

const {
  USER_MANAGER_API_URL,
  IDENTIFIER_FIELDS = "sub",
  RESOLVE_USER_IDENTIFIER,
} = process.env

const identifierFields = IDENTIFIER_FIELDS.split(",")
  .map((f) => f.trim())
  .filter(Boolean)

export const getUserIdFromUserObj = (user: IUser): string => {
  for (const field of identifierFields) {
    const fromUser = user[field]
    if (fromUser) return fromUser

    const fromProps = user.properties?.[field]
    if (fromProps) return fromProps
  }

  throw createHttpError(
    401,
    "User ID not found using field(s): " + identifierFields.join(", ")
  )
}

export const getAllUserIdentifiers = (user: IUser): string[] => {
  const values: string[] = []

  for (const field of identifierFields) {
    const v = user[field] || user.properties?.[field]
    if (v) values.push(String(v))
  }

  return values
}

export const getStableUserIdFromParamsUserId = async (
  currentUser: IUser,
  identifier: string,
  authorization?: string
) => {
  const currentUserIdentifiers = getAllUserIdentifiers(currentUser)
  const isSelf =
    identifier === "self" || currentUserIdentifiers.includes(identifier)
  if (isSelf) return getUserIdFromUserObj(currentUser)
  if (RESOLVE_USER_IDENTIFIER?.toLowerCase() !== "true") return identifier
  try {
    const userData = await fetchUserData(identifier, authorization)
    return getUserIdFromUserObj(userData)
  } catch (error: any) {
    if (error?.status === 404) {
      throw createHttpError(403, `No user found for identifier "${identifier}"`)
    }
    throw error
  }
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
    const res = await axios.get(`${USER_MANAGER_API_URL}/${user_id}`, {
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
