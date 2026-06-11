import createHttpError from "http-errors"
import IUser from "./interfaces/user"
import axios from "axios"
import { Request, Response } from "express"

const { USER_MANAGER_API_URL, IDENTIFIER_FIELD = "_id" } = process.env
const identifierFields = IDENTIFIER_FIELD.split(",")
  .map((f) => f.trim())
  .filter(Boolean)

export const getUserIdFromUserObj = (user: IUser): string => {
  for (const field of identifierFields) {
    const fromUser = user[field]
    if (fromUser) return fromUser

    const fromProps = user.properties?.[field]
    if (fromProps) return fromProps
  }

  throw new Error(
    "User ID not found using fields: " + identifierFields.join(", ")
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
  req: Request, // TODO: this will be the id
  res: Response // TODO: the IUSER
) => {
  const identifier = req.params.user_id
  if (!identifier) throw createHttpError(400, "User ID not provided")

  const currentUser = res.locals.user as IUser
  const currentUserIdentifiers = getAllUserIdentifiers(currentUser)

  // 1. If the param matches ANY identifier of the current user, it's self
  const isSelf =
    identifier === "self" || currentUserIdentifiers.includes(identifier)

  if (isSelf) return getUserIdFromUserObj(currentUser)

  return identifier
  // TODO: Add compatibility layer to fetch user data from USER_MANAGER_API for non-self
  //  identifiers if needed. This is required if we want to allow access to other users'
  //  data by their username, email, etc.
  // Currently, only self-access is supported, and the identifier param must match one of the current user's identifiers.
  // const targetUser = isSelf
  //   ? currentUser
  //   : await fetchUserData(identifier, req.headers.authorization) // TODO: Make it configurable

  // // 2. configured ID always used for DB queries
  // return getUserIdFromUserObj(targetUser)
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
