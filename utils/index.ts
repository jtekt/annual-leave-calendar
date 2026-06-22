import createHttpError from "http-errors"
import IUser from "../interfaces/user"
import { fetchUserData } from "../services/members"

const { IDENTIFIER_FIELDS = "sub", RESOLVE_USER_IDENTIFIER } = process.env

const identifierFields = IDENTIFIER_FIELDS.split(",")
  .map((f) => f.trim())
  .filter(Boolean)

export const getUserIdFromUserObj = (user: IUser | undefined): string => {
  if (user) {
    for (const field of identifierFields) {
      const fromUser = user[field]
      if (fromUser) return fromUser

      const fromProps = user.properties?.[field]
      if (fromProps) return fromProps
    }
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
  reqHeaders: Record<string, any>
) => {
  const currentUserIdentifiers = getAllUserIdentifiers(currentUser)
  const isSelf =
    identifier === "self" || currentUserIdentifiers.includes(identifier)
  if (isSelf) return getUserIdFromUserObj(currentUser)
  if (RESOLVE_USER_IDENTIFIER?.toLowerCase() !== "true") return identifier
  try {
    const userData = await fetchUserData(identifier, reqHeaders)
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

/**
 * Extracts authentication headers from request
 * Supports both authorization and x-api-key headers
 */
export function extractAuthHeaders(reqHeaders: Record<string, any>) {
  const headers: Record<string, string> = {}

  if (reqHeaders.authorization) {
    headers["Authorization"] = reqHeaders.authorization
  }

  if (reqHeaders["x-api-key"]) {
    headers["x-api-key"] = reqHeaders["x-api-key"] as string
  }

  return headers
}
