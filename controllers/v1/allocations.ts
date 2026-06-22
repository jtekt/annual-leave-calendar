import axios from "axios"
import Allocation from "../../models/allocation"
import createHttpError from "http-errors"
import {
  extractAuthHeaders,
  getStableUserIdFromParamsUserId,
  getUserIdFromUserObj,
} from "../../utils"
import { validate } from "../../utils/validate"
import { DEFAULT_BATCH_SIZE } from "../../constants"
import { Request, Response } from "express"
import IUser from "../../interfaces/user"
import IGroup from "../../interfaces/group"
import IAllocation from "../../interfaces/allocation"
import {
  AllocationUserParamsSchema,
  AllocationIdParamsSchema,
  AllocationGroupParamsSchema,
  GetAllocationsOfUserQuerySchema,
  GetAllocationsOfGroupQuerySchema,
  GetAllAllocationsQuerySchema,
  CreateAllocationBodySchema,
} from "../../validation/allocations"
import { fetchGroupMembers } from "../../services/members"

function get_current_user(res: Response) {
  const { user } = res.locals
  return user
}

export const get_allocations_of_user = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(
    AllocationUserParamsSchema,
    req.params
  )
  const { year } = validate(GetAllocationsOfUserQuerySchema, req.query)

  const current_user = get_current_user(res)
  const user_id = await getStableUserIdFromParamsUserId(
    current_user,
    identifier,
    req.headers
  )

  const query: any = { user_id }
  if (year) query.year = year

  const allocations = await Allocation.find(query).sort("year")

  res.send(allocations)
}

export const get_allocations_of_group = async (req: Request, res: Response) => {
  const { group_id } = validate(AllocationGroupParamsSchema, req.params)
  const { year, limit, skip } = validate(
    GetAllocationsOfGroupQuerySchema,
    req.query
  )

  const { users, total_of_users } = await fetchGroupMembers(
    group_id,
    req.headers,
    limit,
    skip
  )

  const user_ids = users.map((user: IUser) => ({
    user_id: getUserIdFromUserObj(user),
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
    const user_id = getUserIdFromUserObj(user)
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
  const { user_id: identifier } = validate(
    AllocationUserParamsSchema,
    req.params
  )
  const { year, leaves, reserve } = validate(
    CreateAllocationBodySchema,
    req.body
  )

  const current_user = get_current_user(res)
  const user_id = await getStableUserIdFromParamsUserId(
    current_user,
    identifier,
    req.headers
  )

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
  const { _id } = validate(AllocationIdParamsSchema, req.params)

  const allocation = await Allocation.findById(_id)
  res.send(allocation)
}

export const get_all_allocations = async (req: Request, res: Response) => {
  const { year, user_id, limit, skip } = validate(
    GetAllAllocationsQuerySchema,
    req.query
  )

  const query: any = {}
  if (year) query.year = year
  if (user_id) query.user_id = user_id

  const allocations = await Allocation.find(query)
    .sort({ user_id, year })
    .skip(skip)
    .limit(Math.max(limit, 0))

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
  const { _id } = validate(AllocationIdParamsSchema, req.params)

  const result = await Allocation.updateOne({ _id }, req.body)

  res.send(result)
}

export const delete_allocation = async (req: Request, res: Response) => {
  const { _id } = validate(AllocationIdParamsSchema, req.params)

  const result = await Allocation.deleteOne({ _id })

  res.send(result)
}
