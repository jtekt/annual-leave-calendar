import axios from "axios"
import Entry from "../../models/entry"
import createHttpError from "http-errors"
import { collectByKeys, getUserId, getUsername, resolveUserQueryField } from "../../utils"
import mongoose from "mongoose"
import IEntry from "../../interfaces/entry"
import IAllocation from "../../interfaces/allocation"
import { get_user_array_allocations_by_year } from "./allocations"

import { DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"

const { GROUP_MANAGER_API_URL, WORKPLACE_MANAGER_API_URL } = process.env

function get_identifier(res: Response) {
  const { user } = res.locals
  return getUserId(user) || getUsername(user)
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  let identifier: string | undefined = req.params.indentifier
  if (identifier === "self") identifier = get_identifier(res)
  if (!identifier) throw createHttpError(400, `User ID not provided`)

  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
  } = req.query as any

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const { field, value } = resolveUserQueryField(identifier);

  const query = {
    [field]: value,
    date: { $gte: start_of_date, $lte: end_of_date },
  };

  const entries = await Entry.find(query).sort("date")

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
    reserve = false,
  } = req.body

  let identifier: string | undefined = req.params.indentifier
  if (identifier === "self") identifier = get_identifier(res)

  if (!identifier) throw createHttpError(400, `User ID or username not provided`)
  if (!date) throw createHttpError(400, `Date not provided`)

  const { field, value } = resolveUserQueryField(identifier);

  const entry_properties = {
    [field]: value,
    date,
    type,
    am,
    pm,
    taken,
    refresh,
    plus_one,
    reserve,
  }

  const filter = { date, [field]: value }
  const options = { new: true, upsert: true }

  const entry = await Entry.findOneAndUpdate(filter, entry_properties, options)

  res.send(entry)
}

export const create_entries = async (req: Request, res: Response) => {
  const entries = req.body

  if (entries.some((entry: any) => !entry.user_id && !entry.preferred_username))
    throw createHttpError(400, `User ID or preferred_username not provided`);

  if (entries.some(({ date }: IEntry) => !date))
    throw createHttpError(400, `User ID not provided`)

  const result = await Entry.insertMany(entries)
  res.send(result)
}

export const get_single_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const entry = await Entry.findById(_id)

  res.send(entry)
}

export const get_all_entries = async (req: Request, res: Response) => {
  const {
    year = new Date().getFullYear(),
    start_date,
    end_date,
    indentifiers,
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

  if (indentifiers) {
    const userIdArray = Array.isArray(indentifiers) ? indentifiers : [indentifiers];
    query.$or = userIdArray.map((id: string) => {
      const { field, value } = resolveUserQueryField(id);
      return { [field]: value };
    });
  }

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
}

export const update_entry = async (req: Request, res: Response) => {
  const { _id } = req.params

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
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Entry.deleteOne({ _id })
  res.send(result)
}

export const delete_entries = async (req: Request, res: Response) => {
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
    const { response = {} } = error
    const { status = 500, data = "Failed to query group members" } = response
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const identifiers = users.flatMap(user => {
    const user_id = getUserId(user);
    const preferred_username = getUsername(user);

    const clauses: { user_id?: string; preferred_username?: string }[] = [];

    if (user_id) clauses.push({ user_id });
    if (preferred_username) clauses.push({ preferred_username });

    return clauses;
  });

  if (!identifiers.length)
    throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const query = {
    $or: identifiers,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = collectByKeys<IEntry>(
    entries,
    (entry) => [entry.user_id, (entry as any).preferred_username],
    (acc, entry, key) => {
      acc[key] = acc[key] || [];
      acc[key].push(entry);
    }
  );

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    identifiers
  )

  const allocations_mapping = collectByKeys<IAllocation>(
    result_allocations.allocations,
    (allocation) => [allocation.user_id, (allocation as any).preferred_username],
    (acc, allocation, key) => {
      acc[key] = allocation;
    }
  );

  const output = users.map((user: any) => {
    const keys = [getUserId(user), getUsername(user)].filter(Boolean);
    if (!keys.length) throw new Error("User has no user_id or preferred_username");

    const entries: IEntry[] = Array.from(
      new Map(
        keys
          .flatMap(key => entries_mapping[key] || [])
          .map(entry => [entry._id.toString(), entry])
      ).values()
    );
    const allocations = keys.map(key => allocations_mapping[key]).find(Boolean) || null;

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
    const { response = {} } = error
    const { status = 500, data = "Failed to query workplace members" } =
      response
    throw createHttpError(status, data)
  }

  const start_of_date = start_date
    ? new Date(start_date)
    : new Date(`${year}/01/01`)
  const end_of_date = end_date ? new Date(end_date) : new Date(`${year}/12/31`)

  const identifiers = users.flatMap(user => {
    const user_id = getUserId(user);
    const preferred_username = getUsername(user);

    const clauses: { user_id?: string; preferred_username?: string }[] = [];

    if (user_id) clauses.push({ user_id });
    if (preferred_username) clauses.push({ preferred_username });

    return clauses;
  });

  if (!identifiers.length)
    throw createHttpError(404, `Workplace ${workplace_id} appears to be empty`)

  const query = {
    $or: identifiers,
    date: { $gte: start_of_date, $lte: end_of_date },
  }

  const entries = await Entry.find(query).sort("date")

  const entries_mapping = collectByKeys<IEntry>(
    entries,
    (entry) => [entry.user_id, (entry as any).preferred_username],
    (acc, entry, key) => {
      acc[key] = acc[key] || [];
      acc[key].push(entry);
    }
  );

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    identifiers
  )

  const allocations_mapping = collectByKeys<IAllocation>(
    result_allocations.allocations,
    (allocation) => [allocation.user_id, (allocation as any).preferred_username],
    (acc, allocation, key) => {
      acc[key] = allocation;
    }
  );

  const output = users.map((user: any) => {
    const keys = [getUserId(user), getUsername(user)].filter(Boolean);
    if (!keys.length) throw new Error("User has no user_id or preferred_username");

    const entries: IEntry[] = Array.from(
      new Map(
        keys
          .flatMap(key => entries_mapping[key] || [])
          .map(entry => [entry._id.toString(), entry])
      ).values()
    );
    const allocations = keys.map(key => allocations_mapping[key]).find(Boolean) || null;

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
