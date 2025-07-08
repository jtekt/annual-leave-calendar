import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { resolveUserQuery } from "../../utils"
import { get_user_allocations_by_year } from "../v1/allocations"
import { Request, Response } from "express"

export const get_entries_of_user = async (req: Request, res: Response) => {
  let identifier: string | undefined = req.params.indentifier
  if (!identifier || (identifier === "self" && !res.locals.user)) {
    throw createHttpError(400, `User not authenticated or ID not provided`);
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

  let identifierQuery = resolveUserQuery({ identifier, user: res.locals.user })
  const query = {
    $and: [
      identifierQuery,
      {
        date: { $gte: start_of_date, $lte: end_of_date },
      },
    ],
  };
  const entries = await Entry.find(query).sort("date")

  const allocations = await get_user_allocations_by_year(year, identifierQuery)

  res.send({ entries, allocations })
}
