import axios from "axios"
import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { fetchUserData, getUserId, resolveUserEntryFields, resolveUserQuery } from "../../utils"
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
  let identifier: string | undefined = req.params.user_id
  if (!identifier) throw createHttpError(400, `User ID not provided`)
  let current_user = get_current_user(res)
  const isSelf = identifier === "self" || identifier === current_user._id

  if (!isSelf) {
    try {
      current_user = await fetchUserData(identifier, req.headers.authorization)
    } catch (error: any) {
      let user = getUserId(current_user)
      const { response = {} } = error
      const { status = 500, data = "Failed to query entries of user" } = response
      console.error(`${user} : [v1 > get_entries_of_user > USER_MANAGER_API] Failed to fetch ${identifier}:`, data)
      throw createHttpError(status, data)
    }
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

  try {
    const entries = await Entry.find(query).sort("date")

    res.send(entries)
  } catch (error: any) {
    let user = getUserId(current_user);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [v1 > get_entries_of_user] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const create_entry = async (req: Request, res: Response) => {
  let {
    date,
    type = "有休",
    am = true,
    pm = true,
    taken = false,
    refresh = false,
    plus_one = false,
    reserve = false,
  } = req.body
  let identifier: string | undefined = req.params.user_id
  if (!identifier) throw createHttpError(400, `User ID not provided`)
  let current_user = get_current_user(res)
  const isSelf = identifier === "self" || identifier === current_user._id

  if (!date) throw createHttpError(400, `Date not provided`)

  if (!isSelf) {
    try {
      current_user = await fetchUserData(identifier, req.headers.authorization)
    } catch (error: any) {
      let user = getUserId(current_user)
      const { response = {} } = error
      const { status = 500, data = "Failed to create new entry" } = response
      console.error(`${user} : [v1 > create_entry > USER_MANAGER_API] Failed to fetch ${identifier}:`, data)
      throw createHttpError(status, data)
    }
  }

  // --- Normalize date ---
  // Always convert to a real Date object at UTC midnight
  date = new Date(date)
  if (isNaN(date.getTime())) {
    throw createHttpError(400, `Invalid date provided: ${req.body.date}`)
  }
  date.setUTCHours(0, 0, 0, 0)
  const userFields = resolveUserEntryFields(current_user)
  const entry_properties = {
    ...userFields,
    date,
    type,
    am,
    pm,
    taken,
    refresh,
    plus_one,
    reserve,
  }

  try {
    const filter = {
      date,
      ...userFields
    }

    let entry = await Entry.findOneAndUpdate(filter, entry_properties, {
      new: true,
      upsert: false, // avoid duplicate key
    });

    // If not found but user has OIDC, try to match old record
    if (!entry && userFields.oidc_user_identifier) {
      const legacyFilter = { date, user_id: current_user._id };
      entry = await Entry.findOneAndUpdate(
        legacyFilter,
        entry_properties,
        { new: true, upsert: false }
      );
    }

    // If still not found, insert new record
    if (!entry) {
      entry = await Entry.findOneAndUpdate(filter, entry_properties, {
        new: true,
        upsert: true,
      });
    }

    // if found a legacy record and it’s missing OIDC, add it
    if (entry && userFields.oidc_user_identifier && !entry.oidc_user_identifier) {
      entry.oidc_user_identifier = userFields.oidc_user_identifier;
      await entry.save();
    }

    res.send(entry)
  } catch (error: any) {
    let user = getUserId(current_user);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [v1 >  create_entry] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const create_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some(({ user_id }: IEntry) => !user_id))
    throw createHttpError(400, `User ID not provided`)
  if (entries.some(({ date }: IEntry) => !date))
    throw createHttpError(400, `User ID not provided`)

  try {
    const result = await Entry.insertMany(entries)
    res.send(result)
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 >  create_entries] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const get_single_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  try {
    const entry = await Entry.findById(_id)

    res.send(entry)
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 >  get_single_entry] Error:`, message);
    res.status(status).send({ error: message });
  }
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

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const query: any = {
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  if (user_ids) query.$or = user_ids.map((user_id: string) => ({ user_id }))

  try {
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

    res.send(response)
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 >  get_all_entries] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const update_entry = async (req: Request, res: Response) => {
  try {
    const { _id } = req.params

    if (!_id) throw createHttpError(400, `ID is not provided`)

    const result = await Entry.findByIdAndUpdate(_id, req.body, { new: true })
    res.send(result)
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 >  update_entry] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const update_entries = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 >  update_entries] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const delete_entry = async (req: Request, res: Response) => {
  try {
    const { _id } = req.params

    if (!_id) throw createHttpError(400, `ID is not provided`)

    const result = await Entry.findByIdAndDelete(_id)
    res.send(result)
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} [ v1 > delete_entry] Error:`, message);
    res.status(status).send({ error: message });
  }
}

export const delete_entries = async (req: Request, res: Response) => {
  try {
    const entryIds = req.query.ids as string[]

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
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    console.log(`${user} : [ v1 > delete_entries] Error:`, message);
    res.status(status).send({ error: message });
  }
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

  let users: any[]
  let total_of_users: number
  try {
    const url = `${GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
    const headers = { authorization: req.headers.authorization }
    const params = {
      batch_size: limit,
      start_index: skip,
    }

    const { data } = await axios.get(url, { headers, params })
    const { items, count } = data
    users = items
    total_of_users = count
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const { response = {} } = error
    const { status = 500, data = "Failed to query entries of group" } = response
    console.log(`${user} : [ v1 >  get_entries_of_group : ${group_id} > ] Error:`, data);
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const user_ids = users.map((user: IUser) => ({
    user_id: getUserId(user),
  }))

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

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    user_ids
  )

  const allocations_mapping = result_allocations.allocations.reduce(
    (prev: any, allocation: IAllocation) => {
      const { user_id } = allocation
      if (!prev[user_id]) prev[user_id] = {}
      prev[user_id] = allocation
      return prev
    },
    {}
  )

  const output = users.map((user: IGroup) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const entries = entries_mapping[user_id] || []
    const allocations = allocations_mapping[user_id] || null

    // FIXME: Two formats?
    // user.entries = entries
    return { user, entries, allocations }
  })

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
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

  let users: any[]
  let total_of_users: number
  try {
    const url = `${WORKPLACE_MANAGER_API_URL}/v2/workplaces/${workplace_id}/employees`
    const headers = { authorization: req.headers.authorization }
    const params = {
      batch_size: limit,
      start_index: skip,
    }

    const { data, headers: workplaceResHeader } = await axios.get(url, {
      headers,
      params,
    })
    users = data
    total_of_users = Number(workplaceResHeader["x-total"])
  } catch (error: any) {
    let current_user = get_current_user(res)
    let user = getUserId(current_user)
    const { response = {} } = error
    const { status = 500, data = "Failed to query workplace members" } =
      response
    console.log(`${user}: [ v1 > get_entries_of_workplace > ] Error:`, data);
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const user_ids = users.map((user: IUser) => ({
    user_id: getUserId(user),
  }))

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

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    user_ids
  )

  const allocations_mapping = result_allocations.allocations.reduce(
    (prev: any, allocation: IAllocation) => {
      const { user_id } = allocation
      if (!prev[user_id]) prev[user_id] = {}
      prev[user_id] = allocation
      return prev
    },
    {}
  )

  const output = users.map((user: IUser) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const entries = entries_mapping[user_id] || []
    const allocations = allocations_mapping[user_id] || null
    // FIXME: Two formats?
    user.entries = entries
    return { user, entries, allocations }
  })

  const response = {
    start_of_date,
    end_of_date,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
}
