import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { getUserId } from "../../utils"
import { get_user_allocations_by_year } from "../v1/allocations"
import { Request, Response } from "express"

function get_current_user(res: Response) {
  const { user } = res.locals
  return user
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  let identifier = req.params.user_id as string | undefined
  if (!identifier) throw createHttpError(400, `User ID not provided`)
  let current_user = get_current_user(res)
  const user_id = identifier === "self" ? getUserId(current_user) : identifier

  const year = Number(req.query.year ?? new Date().getFullYear())
  const start_date = req.query.start_date
    ? String(req.query.start_date)
    : undefined
  const end_date = req.query.end_date ? String(req.query.end_date) : undefined

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const query = {
    $and: [
      { user_id },
      {
        date: { $gte: start_of_date, $lte: end_of_date },
      },
    ],
  }

  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(year, user_id)

  res.send({ entries, allocations })
}
