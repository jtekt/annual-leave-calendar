import { RequestHandler } from "express"
import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import { authMiddlewareChainer } from "@moreillon/express-auth-middleware-chainer"
import createHttpError from "http-errors"

const { OIDC_JWKS_URI, IDENTIFICATION_URL } = process.env


export const getMiddlewareChain = () => {
    const middlewareList = [];

    if (OIDC_JWKS_URI) {
        middlewareList.push(
            awaitMiddleware(
                oidcAuth({ jwksUri: OIDC_JWKS_URI, lax: !!IDENTIFICATION_URL })
            )
        );
    }

    if (IDENTIFICATION_URL) {
        middlewareList.push(
            awaitMiddleware(
                legacyAuth({ url: IDENTIFICATION_URL })
            )
        );
    }
    if (middlewareList.length === 0) throw createHttpError(400, `Identification URL or OIDC JWKS URI not provided`);
    return authMiddlewareChainer(middlewareList);
}

const awaitMiddleware = (middleware: RequestHandler): RequestHandler => {
    return async (req, res, next) => {
        await new Promise<void>((resolve, reject) => {
            middleware(req, res, (err?: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
        next();
    };
};

