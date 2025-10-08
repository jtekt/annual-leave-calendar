import createHttpError from "http-errors"
import IUser from "./interfaces/user"
import axios from "axios"
export const getUserId = (user: IUser) => user._id || user.properties?._id
export const getOtherUserIdentifier = (user: any) => user[LEGACY_AUTH_IDENTIFIER] || user[OIDC_AUTH_IDENTIFIER]

const {
    OIDC_AUTH_IDENTIFIER = "preferred_username",
    LEGACY_AUTH_IDENTIFIER = "username",
    USER_MANAGER_API_URL } = process.env

export const resolveUserQuery = ({ identifier, user }: { identifier?: string; user?: any }) => {
    if (identifier === "self" && user) {
        const orQuery = [];

        const userId = getUserId(user);
        const otherUserIdentifier = getOtherUserIdentifier(user);

        if (userId) orQuery.push({ user_id: userId });
        if (otherUserIdentifier) orQuery.push({ oidc_user_identifier: otherUserIdentifier });

        return {
            $or: orQuery,
        };
    }
    return {
        $or: [
            { user_id: identifier },
            { oidc_user_identifier: identifier }
        ]
    };
}

export const resolveUserEntryFields = (user: any) => {
    return user._id && user.username && !user[OIDC_AUTH_IDENTIFIER]
        ? { user_id: user._id, oidc_user_identifier: user[LEGACY_AUTH_IDENTIFIER] } // legacy
        : { oidc_user_identifier: user[OIDC_AUTH_IDENTIFIER] }; // OIDC
};

export const collectByKeys = <T>(
    list: T[],
    getKeys: (item: T) => (string | undefined)[],
    accumulate: (acc: Record<string, any>, item: T, key: string) => void,
    initial: Record<string, any> = {}
) =>
    list.reduce((acc, item) => {
        for (const key of getKeys(item).filter(Boolean) as string[]) {
            accumulate(acc, item, key);
        }
        return acc;
    }, initial);

export const fetchUserData = async (user_id: string, authorization?: string) => {
    try {
        const headers: Record<string, string> = {};
        if (authorization?.trim()) headers.Authorization = authorization;
        const res = await axios.get(`${USER_MANAGER_API_URL}/v3/users/${user_id}`, { headers })
        return res.data
    } catch (error: any) {
        const status = error?.response?.status ?? 500;
        const code = error?.code;
        if (status === 403 || status === 401) {
            throw createHttpError(403, "Unauthorized to access USER_MANAGER_API");
        } else if (status === 404) {
            throw createHttpError(404, "User not found in USER_MANAGER_API");
        } else if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
            throw createHttpError(502, "USER_MANAGER_API is unreachable");
        } else {
            throw createHttpError(400, "Failed to fetch from USER_MANAGER_API");
        }
    }
}