import { Request, Response } from "express"
import { listUsersFromDB, getUserFromDB } from "../../services/members"
import { NotImplementedError } from "../../errors"
import { getStableUserIdFromParamsUserId } from "../../utils"

export const list_users = async (req: Request, res: Response) => {
  if (process.env.GROUP_MANAGER_API_URL || process.env.USER_MANAGER_API_URL)
    throw new NotImplementedError(
      "User listing is only available in standalone mode"
    )
  const {
    batch_size = "50",
    start_index = "0",
    search,
  } = req.query as Record<string, string>
  const result = await listUsersFromDB(
    search,
    Number(batch_size),
    Number(start_index)
  )
  res.send(result)
}

export const get_user = async (req: Request, res: Response) => {
  if (process.env.GROUP_MANAGER_API_URL || process.env.USER_MANAGER_API_URL)
    throw new NotImplementedError(
      "User data is only available in standalone mode"
    )
  const user_id = await getStableUserIdFromParamsUserId(
    res.locals.user,
    String(req.params.user_id),
    req.headers
  )
  const user = await getUserFromDB(user_id)
  res.send(user)
}
