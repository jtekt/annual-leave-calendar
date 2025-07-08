import IUser from "./interfaces/user"
export const getUserId = (user: IUser) => user._id || user.properties?._id
export const getUsername = (user: any) => user.preferred_username || user.username

export const resolveUserQuery = ({ identifier, user }: { identifier?: string; user?: any }) => {
    if (identifier === "self" && user) {
        const orQuery = [];

        const userId = getUserId(user);
        const username = getUsername(user);

        if (userId) orQuery.push({ user_id: userId });
        if (username) orQuery.push({ preferred_username: username });

        return {
            $or: orQuery,
        };
    }
    return {
        $or: [
            { user_id: identifier },
            { preferred_username: identifier }
        ]
    };
}

export const resolveUserEntryFields = ({ identifier, user }: { identifier: string; user?: any }) => {
    if (identifier === "self" && user) {
        return user._id && user.username && !user.preferred_username
            ? { user_id: user._id, preferred_username: user.username } // legacy
            : { preferred_username: user.preferred_username }; // OIDC
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const sixDigitRegex = /^\d{6}$/;
    if (uuidRegex.test(identifier) || sixDigitRegex.test(identifier)) {
        return { user_id: identifier };
    } else {
        return { preferred_username: identifier };
    }

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