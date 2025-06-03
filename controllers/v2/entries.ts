import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { getUserId, getUsername, resolveUserQueryField } from "../../utils"
import { get_user_allocations_by_year } from "../v1/allocations"
import { Request, Response } from "express"

function get_current_user_id(res: Response) {
  const { user } = res.locals
  return getUserId(user) || getUsername(user)
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  let user_id: string | undefined = req.params.user_id
  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) throw createHttpError(400, `User ID not provided`)

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const { field, value } = resolveUserQueryField(user_id);

  const query = {
    [field]: value,
    date: { $gte: start_of_date, $lte: end_of_date },
  };

  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(year, user_id)

  res.send({ entries, allocations })
}
