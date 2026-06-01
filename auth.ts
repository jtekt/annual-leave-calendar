import legacyAuth from "@jtekt/express-account-manager-identification-middleware"
import createHttpError from "http-errors"
import { Request, Response, NextFunction, RequestHandler } from "express"

const { USER_MANAGER_API_URL } = process.env

export const identificationMiddleware = () => {
  if (!USER_MANAGER_API_URL)
    throw createHttpError(400, `USER_MANAGER_API_URL not provided`)

  const url = `${USER_MANAGER_API_URL}/v3/users/self`
  console.log("Using USER_MANAGER_API_URL:", url)

  const legacy = legacyAuth({ url })

  return (req: Request, res: Response, next: NextFunction) => {
    const safeHeaders: { [key: string]: string } = {}
    if (req.headers.authorization) {
      safeHeaders.authorization = req.headers.authorization as string
    }
    safeHeaders.accept = "application/json"
    req.headers = safeHeaders

    return legacy(req, res, next)
  }
}

/**
 * CalDAV Basic Auth bridge.
 * CalDAV clients send: Authorization: Basic base64(username:jwt)
 * Extracts the JWT from the password field and rewrites it as Bearer
 * so legacyMiddleware can validate it unchanged.
 */
export const caldavMiddleware = (): RequestHandler => {
  const inner = identificationMiddleware()

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Nenkyuu CalDAV"')
      return next(createHttpError(401, "Authentication required"))
    }

    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
    const colonIdx = decoded.indexOf(":")
    if (colonIdx === -1) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Nenkyuu CalDAV"')
      return next(createHttpError(401, "Invalid credentials"))
    }

    req.headers.authorization = `Bearer ${decoded.slice(colonIdx + 1)}`
    inner(req, res, next)
  }
}
