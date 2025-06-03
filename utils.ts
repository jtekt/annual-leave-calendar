import IUser from "./interfaces/user"
export const getUserId = (user: IUser) => user._id || user.properties?._id
export const getUsername = (user: any) => user.preferred_username || user.username

const isLikelyPreferredUsername = (id: string) => /^00\d{6}$/.test(id);

export const resolveUserQueryField = (id: string) => {
    return isLikelyPreferredUsername(id)
        ? { field: "preferred_username", value: id }
        : { field: "user_id", value: id };
};