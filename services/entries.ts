import z from "zod"
import mongoose from "mongoose"
import Entry from "../models/entry"
import { getUserArrayAllocationsByYear } from "./allocations"
import {
  CreateEntryBodySchema,
  CreateEntriesBodySchema,
  GetAllEntriesQuerySchema,
  GetEntriesOfUserQuerySchema,
  UpdateEntriesBodySchema,
  UpdateEntryBodySchema,
} from "../validation/entries"
import IEntry from "../interfaces/entry"
import IUser from "../interfaces/user"
import IAllocation from "../interfaces/allocation"
import { getUserIdFromUserObj } from "../utils"

// Utils
function dateRange(year: number, start_date?: string, end_date?: string) {
  return {
    start: new Date(start_date ?? `${year}/01/01`),
    end: new Date(end_date ?? `${year}/12/31`),
  }
}

// GET

export async function getEntry(id: string) {
  return Entry.findById(id)
}

export async function listEntries(
  params: z.infer<typeof GetAllEntriesQuerySchema>
) {
  const { year, start_date, end_date, user_ids, limit, skip } = params
  const numericLimit = Math.max(limit, 0)
  const { start, end } = dateRange(year, start_date, end_date)

  const query: mongoose.FilterQuery<IEntry> = {
    date: { $gte: start, $lte: end },
  }
  if (user_ids?.length) query.$or = user_ids.map((id) => ({ user_id: id }))

  const [entries, total] = await Promise.all([
    Entry.find(query).skip(skip).limit(numericLimit),
    Entry.countDocuments(query),
  ])
  return {
    start_of_date: start,
    end_of_date: end,
    limit: numericLimit,
    skip,
    total,
    entries,
  }
}

export async function listEntriesOfUser(
  user_id: string,
  params: z.infer<typeof GetEntriesOfUserQuerySchema>
) {
  const { year, start_date, end_date } = params
  const resolvedYear = year ?? new Date().getFullYear()
  const { start, end } = dateRange(resolvedYear, start_date, end_date)
  return Entry.find({ user_id, date: { $gte: start, $lte: end } }).sort("date")
}

export async function listEntriesOfGroup(
  users: IUser[],
  total_of_users: number,
  year: number,
  start_date: string | undefined,
  end_date: string | undefined,
  limit: number,
  skip: number
) {
  const { start, end } = dateRange(year, start_date, end_date)
  const user_ids = users.map((u) => ({ user_id: getUserIdFromUserObj(u) }))

  const entries = await Entry.find({
    $or: user_ids,
    date: { $gte: start, $lte: end },
  }).sort("date")

  const entries_mapping = entries.reduce(
    (prev: { [key: string]: IEntry[] }, entry: IEntry) => {
      const { user_id } = entry
      if (!prev[user_id]) prev[user_id] = []
      prev[user_id].push(entry)
      return prev
    },
    {}
  )

  const { allocations } = await getUserArrayAllocationsByYear(user_ids, year)

  const allocations_mapping = allocations.reduce(
    (prev: { [key: string]: IAllocation }, allocation: IAllocation) => {
      prev[allocation.user_id] = allocation
      return prev
    },
    {}
  )

  const items = users.map((user) => {
    const user_id = getUserIdFromUserObj(user)
    if (!user_id) throw new Error("User has no ID")
    const entries = entries_mapping[user_id] || []
    return {
      user,
      entries,
      allocations: allocations_mapping[user_id] || null,
    }
  })

  return {
    start_of_date: start,
    end_of_date: end,
    limit,
    skip,
    total: total_of_users,
    items,
  }
}

// CREATE

export async function createEntry(
  user_id: string,
  fields: z.infer<typeof CreateEntryBodySchema>
) {
  const { date: dateStr, ...otherFields } = fields
  const [y, m, d] = dateStr.split(/[-/]/).map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return Entry.findOneAndUpdate(
    { user_id, date },
    { user_id, date, ...otherFields },
    { new: true, upsert: true }
  )
}

export async function createEntries(
  entries: z.infer<typeof CreateEntriesBodySchema>
) {
  return Entry.insertMany(entries)
}

// UPDATE

export async function updateEntry(
  id: string,
  fields: z.infer<typeof UpdateEntryBodySchema>
) {
  const { date: dateStr, ...otherFields } = fields

  const update: Record<string, any> = { ...otherFields }

  if (dateStr) {
    const [y, m, d] = dateStr.split(/[-/]/).map(Number)
    update.date = new Date(Date.UTC(y, m - 1, d))
  }

  const res = await Entry.updateOne({ _id: id }, { $set: update })

  return res
}

export async function updateEntries(
  entries: z.infer<typeof UpdateEntriesBodySchema>
) {
  const bulkOps = entries.map(({ _id, type }) => ({
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId(_id) },
      update: { $set: { type: String(type) } },
    },
  }))
  return Entry.collection.bulkWrite(bulkOps)
}

// DELETE

export async function deleteEntry(id: string) {
  return Entry.deleteOne({ _id: id })
}

export async function deleteEntries(ids: string[]) {
  const bulkOps = ids.map((_id) => ({
    deleteOne: { filter: { _id: mongoose.Types.ObjectId(_id) } },
  }))
  return Entry.collection.bulkWrite(bulkOps)
}
