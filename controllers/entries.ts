import axios from "axios"
import Entry from "../models/entry"
import createHttpError from "http-errors"
import { get_id_of_item } from "../utils"

import mongoose from "mongoose"

import { Request, Response } from "express"

function get_current_user_id(res: Response) {
  const { user } = res.locals
  return get_id_of_item(user)
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  let { user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)

  if (!user_id) throw createHttpError(400, `User ID not provided`)

  const { year = new Date().getFullYear(), start_date, end_date } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const query = { user_id, date: { $gte: start_of_date, $lte: end_of_date } }

  const entries = await Entry.find(query).sort("date")

  console.log(`[Mongoose] 予定 of user ${user_id} queried`)
  res.send(entries)
}


export const create_entry = async (req: Request, res: Response) => {
  const {
    date,
    type = "有休",
    am = true,
    pm = true,
    taken = false,
    refresh = false,
    plus_one = false,
  } = req.body

  let { user_id } = req.params
  if (user_id === "self") user_id = get_current_user_id(res)

  if (!user_id) throw createHttpError(400, `User ID not provided`)
  if (!date) throw createHttpError(400, `Date not provided`)

  const entry_properties = {
    user_id,
    date,
    type,
    am,
    pm,
    taken,
    refresh,
    plus_one,
  }

  const entry = await Entry.create(entry_properties)

  console.log(`[Mongoose] Entry ${entry._id} created for user ${user_id}`)
  res.send(entry)
}

export const create_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some(({ user_id }: any) => !user_id))
    throw createHttpError(400, `User ID not provided`)
  if (entries.some(({ date }: any) => !date))
    throw createHttpError(400, `User ID not provided`)

  const result = await Entry.insertMany(entries)
  console.log(`[Mongoose] created entries`)
  res.send(result)
}

export const get_single_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const entry = await Entry.findById(_id)

  console.log(`[Mongoose] 予定 ${entry._id} queried`)
  res.send(entry)
}

export const get_all_entries = async (req: Request, res: Response) => {
  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    user_ids,
    limit = 100,
    skip = 0,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const query: any = {
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  if (user_ids) query.$or = user_ids.map((user_id: string) => ({ user_id }))

  const entries = await Entry.find(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Entry.countDocuments(query)

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total,
    entries,
  }

  console.log(`[Mongoose] Queried entries`)
  res.send(response)
}

export const update_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Entry.updateOne({ _id }, req.body)

  console.log(`[Mongoose] 予定 ${_id} updated`)
  res.send(result)
}

export const update_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some(({ _id }: any) => !_id))
    throw createHttpError(400, `_id not provided`)
  if (entries.some(({ type }: any) => !type))
    throw createHttpError(400, `type not provided`)

  const bulkOps = entries.map((entry: any) => {
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
  console.log(`[Mongoose] updated entries`)
  res.send(result)
}

export const delete_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Entry.deleteOne({ _id })

  console.log(`[Mongoose] 予定 ${_id} deleted`)
  res.send(result)
}

export const delete_entries = async (req: Request, res: Response) => {
  const entries = req.query.ids as any[]

  if (!entries) throw createHttpError(400, `_id not provided`)

  const bulkOps = entries.map((_id) => {
    let opts = {
      deleteOne: {
        filter: {
          _id: mongoose.Types.ObjectId(_id),
        },
      },
    }
    return opts
  })

  // Warning: bulkWrite does not apply validation
  // Could consider using a for loop and updateOne with upsert
  // However, this would seriously impact performance
  const result = await Entry.collection.bulkWrite(bulkOps)
  console.log(`[Mongoose] deleted entries`)
  res.send(result)
}

export const get_entries_of_group = async (req: Request, res: Response) => {
  const { group_id } = req.params
  const url = `${process.env.GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
  const headers = { authorization: req.headers.authorization }

  const {
    data: { items: users },
  } = await axios.get(url, { headers })

  const { year = new Date().getFullYear(), start_date, end_date } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const user_ids = users.map((user: any) => ({ user_id: get_id_of_item(user) }))

  if (!user_ids.length)
    throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const query = {
    $or: user_ids,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  // TODO: Could probably be achieved using reduce
  let entries_mapping : any = {}
  entries.forEach((entry: any) => {
    if (!entries_mapping[entry.user_id]) {
      entries_mapping[entry.user_id] = []
    }
    entries_mapping[entry.user_id].push(entry)
  })

  const output = users.map((user: any) => {
    const user_id = get_id_of_item(user)
    user.entries = entries_mapping[user_id] || []
    return { user, entries: entries_mapping[user_id] || [] }
  })

  console.log(`[Mongoose] Entries of group ${group_id} queried`)

  res.send(output)
}
