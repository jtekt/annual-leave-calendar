import { getStableUserIdFromParamsUserId } from "../../utils"
import { validate } from "../../utils/validate"
import { Request, Response } from "express"
import {
  EntryUserParamsSchema,
  GetEntriesOfUserQuerySchema,
} from "../../validation/entries"
import { listEntriesOfUser } from "../../services/entries"
import { getUserAllocationByYear } from "../../services/allocations"

export const get_entries_of_user = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(EntryUserParamsSchema, req.params)
  const params = validate(GetEntriesOfUserQuerySchema, req.query)
  const user_id = await getStableUserIdFromParamsUserId(res.locals.user, identifier, req.headers)
  const resolvedYear = params.year ?? new Date().getFullYear()

  const [entries, allocations] = await Promise.all([
    listEntriesOfUser(user_id, params),
    getUserAllocationByYear(user_id, resolvedYear),
  ])

  res.send({ entries, allocations })
}
