import middleware, {
  type Options,
} from "@jtekt/express-authentication-middleware"
import createHttpError from "http-errors"
import { Request, Response, NextFunction, RequestHandler } from "express"

const { USER_MANAGER_API_URL } = process.env

export const identificationMiddleware = () => {
  if (!USER_MANAGER_API_URL)
    throw createHttpError(400, `USER_MANAGER_API_URL not provided`)

  const url = `${USER_MANAGER_API_URL}/v3/users/self`
  console.log("Using USER_MANAGER_API_URL:", url)
  const options: Options = {
    strategies: {
      identification: {
        url,
      },
    },
  }
  return middleware(options)
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

    // Save headers before identificationMiddleware strips them — CalDAV handlers
    // need Depth, Content-Type, etc. after auth completes.
    const savedHeaders = { ...req.headers }
    req.headers.authorization = `Bearer ${decoded.slice(colonIdx + 1)}`

    inner(req, res, (err?: any) => {
      req.headers = { ...savedHeaders }
      next(err)
    })
  }
}
