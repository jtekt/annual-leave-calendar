import { Request, Response } from "express"
import { listWorkplacesFromDB } from "../../services/members"
import { NotImplementedError } from "../../errors"

export const list_workplaces = async (_req: Request, res: Response) => {
  if (!process.env.STANDALONE_MODE)
    throw new NotImplementedError(
      "Workplace listing is only available in standalone mode"
    )
  const workplaces = await listWorkplacesFromDB()
  res.send(workplaces)
}
