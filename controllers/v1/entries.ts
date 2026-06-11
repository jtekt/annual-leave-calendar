import axios from "axios"
import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { getUserId } from "../../utils"
import mongoose from "mongoose"
import IEntry from "../../interfaces/entry"
import IUser from "../../interfaces/user"
import IAllocation from "../../interfaces/allocation"
import IGroup from "../../interfaces/group"
import { get_user_array_allocations_by_year } from "./allocations"

import { TOTAL_HEADER, DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"

const { GROUP_MANAGER_API_URL, WORKPLACE_MANAGER_API_URL } = process.env

function get_current_user(res: Response) {
  const { user } = res.locals
  return user
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  const identifier = req.params.user_id as string | undefined
  if (!identifier) throw createHttpError(400, "User ID not provided")

  const currentUser = get_current_user(res)
  const user_id = identifier === "self" ? getUserId(currentUser) : identifier

  const year = Number((req.query as any).year) || new Date().getFullYear()
  const start = (req.query as any).start_date
    ? new Date((req.query as any).start_date)
    : new Date(`${year}-01-01`)

  const end = (req.query as any).end_date
    ? new Date((req.query as any).end_date)
    : new Date(`${year}-12-31`)

  const query = {
    user_id,
    date: { $gte: start, $lte: end },
  }

  const entries = await Entry.find(query).sort("date")

  res.send(entries)
}

export const create_entry = async (req: Request, res: Response) => {
  const identifier = req.params.user_id as string | undefined
  if (!identifier) throw createHttpError(400, "User ID not provided")

  const {
    date,
    type = "有休",
    am = true,
    pm = true,
    taken = false,
    refresh = false,
    plus_one = false,
    reserve = false,
  } = req.body

  if (!date) throw createHttpError(400, "Date not provided")

  // Determine if it's the same user
  const currentUser = get_current_user(res)
  const user_id = identifier === "self" ? getUserId(currentUser) : identifier

  const entry = await Entry.findOneAndUpdate(
    { user_id, date },
    {
      user_id,
      date,
      type,
      am,
      pm,
      taken,
      refresh,
      plus_one,
      reserve,
    },
    { new: true, upsert: true }
  )

  res.send(entry)
}

export const create_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some(({ user_id }: IEntry) => !user_id))
    throw createHttpError(400, `User ID not provided`)
  if (entries.some(({ date }: IEntry) => !date))
    throw createHttpError(400, `User ID not provided`)

  const result = await Entry.insertMany(entries)
  res.send(result)
}

export const get_single_entry = async (req: Request, res: Response) => {
  const _id = req.params._id as string | undefined

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const entry = await Entry.findById(_id)

  res.send(entry)
}

export const get_all_entries = async (req: Request, res: Response) => {
  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    user_ids,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  const start_of_date = new Date(start_date || `${year}/01/01`)
  const end_of_date = new Date(end_date || `${year}/12/31`)

  const query: any = {
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  if (user_ids) {
    const ids = Array.isArray(user_ids) ? user_ids : String(user_ids).split(",")
    query.$or = ids.map((id) => ({ user_id: id }))
  }

  const numericLimit = Math.max(Number(limit), 0)
  const numericSkip = Number(skip)

  const entries = await Entry.find(query).skip(numericSkip).limit(numericLimit)

  const total = await Entry.countDocuments(query)

  res.send({
    start_of_date,
    end_of_date,
    limit: numericLimit,
    skip: numericSkip,
    total,
    entries,
  })
}

export const update_entry = async (req: Request, res: Response) => {
  const _id = req.params._id as string | undefined

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Entry.updateOne({ _id }, req.body)

  res.send(result)
}

export const update_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some(({ _id }: IEntry) => !_id))
    throw createHttpError(400, `_id not provided`)
  if (entries.some(({ type }: IEntry) => !type))
    throw createHttpError(400, `type not provided`)

  const bulkOps = entries.map((entry: IEntry) => {
    const { type } = entry

    let opts = {
      updateOne: {
        filter: {
          _id: mongoose.Types.ObjectId(entry._id),
        },
        update: {
          $set: {
            type: String(type),
          },
        },
      },
    }

    return opts
  })

  // Warning: bulkWrite does not apply validation
  // Could consider using a for loop and updateOne with upsert
  // However, this would seriously impact performance
  const result = await Entry.collection.bulkWrite(bulkOps)
  res.send(result)
}

export const delete_entry = async (req: Request, res: Response) => {
  const _id = req.params._id as string | undefined

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Entry.deleteOne({ _id })
  res.send(result)
}

export const delete_entries = async (req: Request, res: Response) => {
  const entryIds = req.query.ids as string[] | undefined

  if (!entryIds) throw createHttpError(400, `_id not provided`)

  const bulkOps = entryIds.map((_id) => ({
    deleteOne: {
      filter: {
        _id: mongoose.Types.ObjectId(_id),
      },
    },
  }))

  // Warning: bulkWrite does not apply validation
  // Could consider using a for loop and updateOne with upsert
  // However, this would seriously impact performance
  const result = await Entry.collection.bulkWrite(bulkOps)
  res.send(result)
}

export const get_entries_of_group = async (req: Request, res: Response) => {
  const { group_id } = req.params

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  let users: any[] = []
  let total_of_users = 0

  try {
    const url = `${GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
    const headers = { authorization: req.headers.authorization }
    const params = { batch_size: limit, start_index: skip }

    const { data } = await axios.get(url, { headers, params })
    users = data.items
    total_of_users = data.count
  } catch (error: any) {
    const status = error?.response?.status || 500
    const msg = error?.response?.data || "Failed to query group members"
    throw createHttpError(status, `${msg}: ${group_id}`)
  }

  const start_of_date = new Date(start_date || `${year}/01/01`)
  const end_of_date = new Date(end_date || `${year}/12/31`)
  const user_ids = users.map((user: IUser) => ({ user_id: getUserId(user) }))

  if (!user_ids.length)
    throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const query = {
    $or: user_ids,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = entries.reduce((prev: any, entry: IEntry) => {
    const { user_id } = entry
    if (!prev[user_id]) prev[user_id] = []
    prev[user_id].push(entry)
    return prev
  }, {})

  const { allocations } = await get_user_array_allocations_by_year(
    year,
    user_ids
  )

  const allocations_mapping = allocations.reduce(
    (prev: any, allocation: IAllocation) => {
      const { user_id } = allocation
      if (!prev[user_id]) prev[user_id] = {}
      prev[user_id] = allocation
      return prev
    },
    {}
  )

  const items = users.map((user: IGroup) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const entries = entries_mapping[user_id] || []
    const allocations = allocations_mapping[user_id] || null

    // FIXME: Two formats?
    // user.entries = entries
    return { user, entries, allocations }
  })

  res.send({
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items,
  })
}

export const get_entries_of_workplace = async (req: Request, res: Response) => {
  const { workplace_id } = req.params

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  let users: any[] = []
  let total_of_users = 0

  try {
    const url = `${WORKPLACE_MANAGER_API_URL}/v2/workplaces/${workplace_id}/employees`
    const headers = { authorization: req.headers.authorization }
    const params = { batch_size: limit, start_index: skip }

    const { data, headers: workplaceHeader } = await axios.get(url, {
      headers,
      params,
    })
    users = data
    total_of_users = Number(workplaceHeader["x-total"])
  } catch (error: any) {
    const status = error?.response?.status || 500
    const msg = error?.response?.data || "Failed to query workplace members"
    throw createHttpError(status, `${msg}: ${workplace_id}`)
  }

  const start_of_date = new Date(start_date || `${year}/01/01`)
  const end_of_date = new Date(end_date || `${year}/12/31`)
  const user_ids = users.map((user: IUser) => ({ user_id: getUserId(user) }))

  if (!user_ids.length)
    throw createHttpError(404, `Workplace ${workplace_id} appears to be empty`)

  const query = {
    $or: user_ids,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = entries.reduce((prev: any, entry: IEntry) => {
    const { user_id } = entry
    if (!prev[user_id]) prev[user_id] = []
    prev[user_id].push(entry)
    return prev
  }, {})

  const { allocations } = await get_user_array_allocations_by_year(
    year,
    user_ids
  )

  const allocations_mapping = allocations.reduce(
    (prev: any, allocation: IAllocation) => {
      const { user_id } = allocation
      if (!prev[user_id]) prev[user_id] = {}
      prev[user_id] = allocation
      return prev
    },
    {}
  )

  const items = users.map((user: IUser) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const entries = entries_mapping[user_id] || []
    const allocations = allocations_mapping[user_id] || null
    // FIXME: Two formats?
    user.entries = entries
    return { user, entries, allocations }
  })

  res.send({
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items,
  })
}
