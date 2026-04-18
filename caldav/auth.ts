import { Request, Response, NextFunction, RequestHandler } from "express"
import createHttpError from "http-errors"
import { legacyMiddleware } from "../auth"

/**
 * CalDAV Basic Auth bridge.
 * CalDAV clients send: Authorization: Basic base64(username:jwt)
 * This middleware extracts the JWT from the password field and rewrites
 * the header as Bearer so the existing legacyMiddleware can validate it.
 */
export function createCaldavAuth(): RequestHandler {
  const inner = legacyMiddleware()

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

    const jwt = decoded.slice(colonIdx + 1)
    req.headers.authorization = `Bearer ${jwt}`

    inner(req, res, next)
  }
}
