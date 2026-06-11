import axios from "axios"
import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { getUserId } from "../../utils"
import { validate } from "../../utils/validate"
import mongoose from "mongoose"
import IEntry from "../../interfaces/entry"
import IUser from "../../interfaces/user"
import IAllocation from "../../interfaces/allocation"
import IGroup from "../../interfaces/group"
import { get_user_array_allocations_by_year } from "./allocations"
import { Request, Response } from "express"
import {
  EntryUserParamsSchema,
  EntryIdParamsSchema,
  EntryGroupParamsSchema,
  EntryWorkplaceParamsSchema,
  GetEntriesOfUserQuerySchema,
  GetAllEntriesQuerySchema,
  GetEntriesOfGroupQuerySchema,
  DeleteEntriesQuerySchema,
  CreateEntryBodySchema,
  CreateEntriesBodySchema,
  UpdateEntriesBodySchema,
} from "../../validation"

const { GROUP_MANAGER_API_URL, WORKPLACE_MANAGER_API_URL } = process.env

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

  const currentUser = get_current_user(res)
  const user_id = identifier === "self" ? getUserId(currentUser) : identifier

  const resolvedYear = year ?? new Date().getFullYear()
  const start = start_date
    ? new Date(start_date)
    : new Date(`${resolvedYear}-01-01`)
  const end = end_date ? new Date(end_date) : new Date(`${resolvedYear}-12-31`)

  const query = {
    user_id,
    date: { $gte: start, $lte: end },
  }

  const entries = await Entry.find(query).sort("date")

  res.send(entries)
}

export const create_entry = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(EntryUserParamsSchema, req.params)
  const {
    date: dateStr,
    type,
    am,
    pm,
    taken,
    refresh,
    plus_one,
    reserve,
  } = validate(CreateEntryBodySchema, req.body)
  const date = new Date(dateStr)

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
  const entries = validate(CreateEntriesBodySchema, req.body)

  const result = await Entry.insertMany(entries)
  res.send(result)
}

export const get_single_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)

  const entry = await Entry.findById(_id)

  res.send(entry)
}

export const get_all_entries = async (req: Request, res: Response) => {
  const { year, start_date, end_date, user_ids, limit, skip } = validate(
    GetAllEntriesQuerySchema,
    req.query
  )

  const numericLimit = Math.max(limit, 0)
  const start_of_date = new Date(start_date || `${year}/01/01`)
  const end_of_date = new Date(end_date || `${year}/12/31`)

  const query: any = {
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  if (user_ids && user_ids.length > 0) {
    query.$or = user_ids.map((id) => ({ user_id: id }))
  }

  const entries = await Entry.find(query).skip(skip).limit(numericLimit)

  const total = await Entry.countDocuments(query)

  res.send({
    start_of_date,
    end_of_date,
    limit: numericLimit,
    skip,
    total,
    entries,
  })
}

export const update_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)

  const result = await Entry.updateOne({ _id }, req.body)

  res.send(result)
}

export const update_entries = async (req: Request, res: Response) => {
  const entries = validate(UpdateEntriesBodySchema, req.body)

  const bulkOps = entries.map((entry) => {
    const { _id, type } = entry

    return {
      updateOne: {
        filter: {
          _id: mongoose.Types.ObjectId(_id),
        },
        update: {
          $set: {
            type: String(type),
          },
        },
      },
    }
  })

  // Warning: bulkWrite does not apply validation
  // Could consider using a for loop and updateOne with upsert
  // However, this would seriously impact performance
  const result = await Entry.collection.bulkWrite(bulkOps)
  res.send(result)
}

export const delete_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)

  const result = await Entry.deleteOne({ _id })
  res.send(result)
}

export const delete_entries = async (req: Request, res: Response) => {
  const { ids: entryIds } = validate(DeleteEntriesQuerySchema, req.query)

  const bulkOps = entryIds.map((_id) => ({
    deleteOne: {
      filter: {
        _id: mongoose.Types.ObjectId(_id),
      },
    },
  }))

  // Warning: bulkWrite does not apply validation
  const result = await Entry.collection.bulkWrite(bulkOps)
  res.send(result)
}

export const get_entries_of_group = async (req: Request, res: Response) => {
  const { group_id } = validate(EntryGroupParamsSchema, req.params)
  const { year, start_date, end_date, limit, skip } = validate(
    GetEntriesOfGroupQuerySchema,
    req.query
  )

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
  const { workplace_id } = validate(EntryWorkplaceParamsSchema, req.params)
  const { year, start_date, end_date, limit, skip } = validate(
    GetEntriesOfGroupQuerySchema,
    req.query
  )

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
