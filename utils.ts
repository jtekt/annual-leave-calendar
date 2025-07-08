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

export const resolveUserEntryFields = (user: any) => {
    return user._id && user.username && !user.preferred_username
        ? { user_id: user._id, preferred_username: user.username } // legacy
        : { preferred_username: user.preferred_username }; // OIDC
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