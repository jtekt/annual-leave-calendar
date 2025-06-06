import axios from "axios"
import Allocation from "../../models/allocation"
import createHttpError from "http-errors"
import { collectByKeys, getUserId, getUsername, resolveUserQueryField } from "../../utils"
import { DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"
import IGroup from "../../interfaces/group"
import IAllocation from "../../interfaces/allocation"
const { GROUP_MANAGER_API_URL } = process.env

function getIdentifier(res: Response) {
  const { user } = res.locals
  return getUserId(user) || getUsername(user)
}

export const get_allocations_of_user = async (req: Request, res: Response) => {
  let identifier: string | undefined = req.params.user_id
  if (identifier === "self") identifier = getIdentifier(res)
  if (!identifier) throw createHttpError(400, `User ID not provided`)

  const { year } = req.query as any

  const { field, value } = resolveUserQueryField(identifier);

  const query: any = {
    [field]: value,
  };

  if (year) query.year = year;

  const allocations = await Allocation.find(query).sort("year")

  res.send(allocations)
}

export const get_allocations_of_group = async (req: Request, res: Response) => {
  const { group_id } = req.params

  const {
    year = new Date().getFullYear(),
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

  const output = users.map((user: IGroup) => {
    const keys = [getUserId(user), getUsername(user)].filter(Boolean);
    if (!keys.length) throw new Error("User has no user_id or preferred_username");

    const allocations = keys.map(key => allocations_mapping[key]).find(Boolean) || null;

    return { user, allocations }
  })

  const response = {
    year,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
}

export const get_user_allocations_by_year = async (
  year: Number,
  identifier: string
) => {
  if (!identifier) throw createHttpError(400, `User ID not provided`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const limit = DEFAULT_BATCH_SIZE
  const skip = 0
  const { field, value } = resolveUserQueryField(identifier);

  const query: any = {
    year,
    [field]: value,
  };

  const allocations = await Allocation.findOne(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const response = allocations

  return response
}

export const get_user_array_allocations_by_year = async (
  year: Number,
  identifiers: { user_id?: string; preferred_username?: string }[]
) => {
  if (!identifiers || !identifiers.length)
    throw createHttpError(400, `No user identifiers provided`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const limit = DEFAULT_BATCH_SIZE
  const skip = 0
  const query: any = {
    year,
    $or: identifiers,
  }

  const allocations = await Allocation.find(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Allocation.countDocuments(query)

  const response = {
    year,
    identifiers,
    limit,
    skip,
    total,
    allocations,
  }

  return response
}

export const create_allocation = async (req: Request, res: Response) => {
  const {
    year,
    leaves = { current_year_grants: 0, carried_over: 0 },
    reserve = { current_year_grants: 0, carried_over: 0 },
  } = req.body

  let identifier: string | undefined = req.params.user_id
  if (identifier === "self") identifier = getIdentifier(res)

  if (!identifier) throw createHttpError(400, `User ID not provided`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const { field, value } = resolveUserQueryField(identifier);

  const allocation_properties = {
    year,
    [field]: value,
    leaves,
    reserve,
  }

  const filter = { year, [field]: value }
  const options = { new: true, upsert: true }

  const allocation = await Allocation.findOneAndUpdate(
    filter,
    allocation_properties,
    options
  )

  res.send(allocation)
}

export const get_single_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params
  if (!_id) throw createHttpError(400, `ID is not provided`)

  const allocation = await Allocation.findById(_id)
  res.send(allocation)
}

export const get_all_allocations = async (req: Request, res: Response) => {
  const {
    year,
    user_id,
    limit = DEFAULT_BATCH_SIZE,
    skip = 0,
  } = req.query as any

  const query: any = {}
  if (year) query.year = year
  if (user_id) query.user_id = user_id

  const allocations = await Allocation.find(query)
    .sort({ user_id, year })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Allocation.countDocuments(query)

  const response = {
    year,
    user_id,
    limit,
    skip,
    total,
    allocations,
  }

  res.send(response)
}

export const update_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Allocation.updateOne({ _id }, req.body)

  res.send(result)
}

export const delete_allocation = async (req: Request, res: Response) => {
  const { _id } = req.params

  if (!_id) throw createHttpError(400, `ID is not provided`)

  const result = await Allocation.deleteOne({ _id })

  res.send(result)
}
