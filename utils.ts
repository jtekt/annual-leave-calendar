import IUser from "./interfaces/user"
export const getUserId = (user: IUser) => user._id || user.properties?._id
export const getOtherUserIdentifier = (user: any) => user[LEGACY_AUTH_IDENTIFIER] || user[OIDC_AUTH_IDENTIFIER]

const {
    OIDC_AUTH_IDENTIFIER = "preferred_username",
    LEGACY_AUTH_IDENTIFIER = "username" } = process.env

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