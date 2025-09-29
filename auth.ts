import legacyAuth from "@moreillon/express_identification_middleware"
import oidcAuth from "@moreillon/express-oidc"
import createHttpError from "http-errors"

const { OIDC_JWKS_URI, USER_MANAGER_API_URL } = process.env

export const legacyMiddleware = () => {
    if (!USER_MANAGER_API_URL) throw createHttpError(400, `USER_MANAGER_API_URL not provided`);
    return legacyAuth({ url: `${USER_MANAGER_API_URL}/v3/users/self` });
}

export const oidcMiddleware = () => {
    if (!OIDC_JWKS_URI) throw createHttpError(400, `OIDC_JWKS_URI not provided`);
    return oidcAuth({ jwksUri: OIDC_JWKS_URI });
}
