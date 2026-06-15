import Entry from "../../models/entry"
import { getStableUserIdFromParamsUserId } from "../../utils"
import { validate } from "../../utils/validate"
import { get_user_allocations_by_year } from "../v1/allocations"
import { Request, Response } from "express"
import {
  EntryUserParamsSchema,
  GetEntriesOfUserQuerySchema,
} from "../../validation/entries"

function get_current_user(res: Response) {
  const { user } = res.locals
  return user
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(EntryUserParamsSchema, req.params)
  const { year, start_date, end_date } = validate(
    GetEntriesOfUserQuerySchema,
    req.query
  )

  const current_user = get_current_user(res)
  const user_id = await getStableUserIdFromParamsUserId(
    current_user,
    identifier,
    req.headers.authorization
  )

  const resolvedYear = year ?? new Date().getFullYear()
  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${resolvedYear}/01/01`)
  const end_of_date = end_date
    ? new Date(end_date)
    : new Date(`${resolvedYear}/12/31`)

  const query = {
    $and: [
      { user_id },
      {
        date: { $gte: start_of_date, $lte: end_of_date },
      },
    ],
  }

  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(resolvedYear, user_id)

  res.send({ entries, allocations })
}
