import { Request, Response } from "express"
import { listGroupsFromDB } from "../../services/members"
import { NotImplementedError } from "../../errors"
import { getUserIdFromUserObj } from "../../utils"

export const list_groups = async (_req: Request, res: Response) => {
  if (process.env.GROUP_MANAGER_API_URL || process.env.USER_MANAGER_API_URL)
    throw new NotImplementedError(
      "Group listing is only available in standalone mode"
    )
  const currentUserId = getUserIdFromUserObj(res.locals.user)
  const groups = await listGroupsFromDB(currentUserId)

  res.send(groups)
}
