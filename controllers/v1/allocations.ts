import axios from "axios"
import Allocation from "../../models/allocation"
import createHttpError from "http-errors"
import { getUserId } from "../../utils"
import { DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"
import IUser from "../../interfaces/user"
import IGroup from "../../interfaces/group"
import IAllocation from "../../interfaces/allocation"
const { GROUP_MANAGER_API_URL } = process.env

function get_current_user_id(res: Response) {
  const { user } = res.locals
  return getUserId(user)
}

export const get_allocations_of_user = async (req: Request, res: Response) => {
  let user_id: string | undefined = req.params.user_id
  if (user_id === "self") user_id = get_current_user_id(res)
  if (!user_id) throw createHttpError(400, `User ID not provided`)

  const { year } = req.query as any

  const query: any = {}
  query.user_id = user_id
  if (year) query.year = year

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

  const user_ids = users.map((user: IUser) => ({
    user_id: getUserId(user),
  }))

  if (!user_ids.length)
    throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const result_allocations = await get_user_array_allocations_by_year(
    year,
    user_ids
  )

  const allocations_mapping = result_allocations.allocations.reduce(
    (prev: any, allocation: IAllocation) => {
      const { user_id } = allocation
      if (!prev[user_id]) prev[user_id] = []
      prev[user_id].push(allocation)
      return prev
    },
    {}
  )

  const output = users.map((user: IGroup) => {
    const user_id = getUserId(user)
    if (!user_id) throw "User has no ID"
    const allocatons = allocations_mapping[user_id] || []

    return { user, allocatons }
  })

  const response = {
    year,
    user_ids,
    limit,
    skip,
    total: total_of_users,
    items: output,
  }

  res.send(response)
}

export const get_user_allocations_by_year = async (
  year: Number,
  user_id: String
) => {
  if (!user_id) throw createHttpError(400, `User ID not provided`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const limit = DEFAULT_BATCH_SIZE
  const skip = 0
  const query: any = { year, user_id }

  const allocations = await Allocation.findOne(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const response = allocations

  return response
}

export const get_user_array_allocations_by_year = async (
  year: Number,
  user_ids: {
    user_id: string | undefined
  }[]
) => {
  if (!user_ids)
    throw createHttpError(400, `No User IDs found in the provided array`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const limit = DEFAULT_BATCH_SIZE
  const skip = 0
  const query: any = { year, $or: user_ids }

  const allocations = await Allocation.find(query)
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const total = await Allocation.countDocuments(query)

  const response = {
    year,
    user_ids,
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

  let user_id: string | undefined = req.params.user_id
  if (user_id === "self") user_id = get_current_user_id(res)

  if (!user_id) throw createHttpError(400, `User ID not provided`)
  if (!year) throw createHttpError(400, `Year not provided`)

  const allocation_properties = {
    year,
    user_id,
    leaves,
    reserve,
  }

  const filter = { year, user_id }
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
