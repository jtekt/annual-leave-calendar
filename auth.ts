import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import createHttpError from "http-errors"
import { Request, Response, NextFunction, RequestHandler } from "express"

const { OIDC_JWKS_URI, USER_MANAGER_API_URL } = process.env

export const legacyMiddleware = () => {
    if (!USER_MANAGER_API_URL) throw createHttpError(400, `USER_MANAGER_API_URL not provided`);
    return legacyAuth({ url: `${USER_MANAGER_API_URL}/v3/users/self` });
}

export const oidcMiddleware = () => {
    if (!OIDC_JWKS_URI) throw createHttpError(400, `OIDC_JWKS_URI not provided`);
    return oidcAuth({ jwksUri: OIDC_JWKS_URI });
}

/**
 * CalDAV Basic Auth bridge.
 * CalDAV clients send: Authorization: Basic base64(username:jwt)
 * Extracts the JWT from the password field and rewrites it as Bearer
 * so legacyMiddleware can validate it unchanged.
 */
export const caldavMiddleware = (): RequestHandler => {
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

        req.headers.authorization = `Bearer ${decoded.slice(colonIdx + 1)}`
        inner(req, res, next)
    }
}
