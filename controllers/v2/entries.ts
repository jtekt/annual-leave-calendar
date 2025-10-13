import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { fetchUserData, getUserId, resolveUserQuery } from "../../utils"
import { get_user_allocations_by_year } from "../v1/allocations"
import { Request, Response } from "express"

function get_current_user(res: Response) {
  const { user } = res.locals
  return user
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  let identifier: string | undefined = req.params.user_id
  if (!identifier) throw createHttpError(400, `User ID not provided`)
  let current_user = get_current_user(res)
  const isSelf = identifier === "self" || identifier === current_user._id

  if (!isSelf) {
    current_user = await fetchUserData(
      identifier, req.headers.authorization)
  }
  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)


  let identifierQuery = resolveUserQuery({ identifier, user: current_user })
  const query = {
    $and: [
      identifierQuery,
      {
        date: { $gte: start_of_date, $lte: end_of_date },
      },
    ],
  };

  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(year, current_user._id)

  res.send({ entries, allocations })
}

