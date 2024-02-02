import IUser from "./interfaces/user"
export const getUserId = (user: IUser) => user._id || user.properties?._id
