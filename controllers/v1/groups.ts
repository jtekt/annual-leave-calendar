import { Request, Response } from "express"
import { listGroupsFromDB } from "../../services/members"
import { NotImplementedError } from "../../errors"

export const list_groups = async (_req: Request, res: Response) => {
  if (!process.env.STANDALONE_MODE)
    throw new NotImplementedError(
      "Group listing is only available in standalone mode"
    )
  const groups = await listGroupsFromDB()

  console.log("list_groups: groups", groups)
  res.send(groups)
}
