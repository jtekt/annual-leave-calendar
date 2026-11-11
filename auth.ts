import middleware, {
  type Options,
} from "@jtekt/express-authentication-middleware"
import { Request, Response, NextFunction, RequestHandler } from "express"
import { UnauthorizedError, ValidationError } from "./errors"
import { getUserIdFromUserObj } from "./utils"
import UserModel from "./models/user"

const { IDENTIFICATION_URL, STANDALONE_MODE } = process.env

export const identificationMiddleware = () => {
  if (!IDENTIFICATION_URL)
    throw new ValidationError(`IDENTIFICATION_URL not provided`)

  const options: Options = {
    strategies: {
      identification: {
        url: IDENTIFICATION_URL,
        identifierField: "_id",
      },
    },
  }

  return middleware(options)
}

export const jitUserCreationMiddleware = (): RequestHandler => {
  return async (_req: Request, res: Response, next: NextFunction) => {
    if (!STANDALONE_MODE) return next()
    try {
      const user = res.locals.user
      const user_id = getUserIdFromUserObj(user)
      console.log("JIT user creation middleware: creating user in DB", user_id)
      if (user_id) {
        await UserModel.updateOne(
          { user_id },
          { $setOnInsert: { user_id }, $set: { properties: user } },
          { upsert: true }
        )
      }
    } catch (e) {
      console.error(
        "JIT user creation middleware: failed to create user in DB",
        e
      )
      // non-fatal: JIT failure should not block the request
    }
    next()
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
      throw new UnauthorizedError("Authentication required")
    }

    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
    const colonIdx = decoded.indexOf(":")
    if (colonIdx === -1) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Nenkyuu CalDAV"')
      throw new UnauthorizedError("Invalid Basic auth format")
    }

    const secret = decoded.slice(colonIdx + 1) // JWT or API key

    // Save headers before identificationMiddleware strips them — CalDAV handlers
    // need Depth, Content-Type, etc. after auth completes.
    const savedHeaders = { ...req.headers }
    const looksLikeJwt = secret.split(".").length === 3

    if (looksLikeJwt) {
      req.headers.authorization = `Bearer ${secret}`
      delete req.headers["x-api-key"]
    } else {
      req.headers["x-api-key"] = secret
      delete req.headers.authorization
    }

    inner(req, res, (err?: any) => {
      req.headers = { ...savedHeaders }
      next(err)
    })
  }
}
