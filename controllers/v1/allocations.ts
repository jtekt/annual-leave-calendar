import createHttpError from "http-errors"
import { getStableUserIdFromParamsUserId, getUserIdFromUserObj } from "../../utils"
import { validate } from "../../utils/validate"
import { Request, Response } from "express"
import IUser from "../../interfaces/user"
import {
  AllocationUserParamsSchema,
  AllocationIdParamsSchema,
  AllocationGroupParamsSchema,
  GetAllocationsOfUserQuerySchema,
  GetAllocationsOfGroupQuerySchema,
  GetAllAllocationsQuerySchema,
  CreateAllocationBodySchema,
  UpdateAllocationBodySchema,
} from "../../validation/allocations"
import {
  getAllocation,
  listAllocations,
  listAllocationsOfUser,
  createOrUpdateAllocation,
  updateAllocation,
  deleteAllocation,
  getUserArrayAllocationsByYear,
} from "../../services/allocations"
import { fetchGroupMembers } from "../../services/members"

export const get_allocations_of_user = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(AllocationUserParamsSchema, req.params)
  const params = validate(GetAllocationsOfUserQuerySchema, req.query)
  const user_id = await getStableUserIdFromParamsUserId(res.locals.user, identifier, req.headers)
  const allocations = await listAllocationsOfUser(user_id, params)
  res.send(allocations)
}

export const get_allocations_of_group = async (req: Request, res: Response) => {
  const { group_id } = validate(AllocationGroupParamsSchema, req.params)
  const { year, limit, skip } = validate(GetAllocationsOfGroupQuerySchema, req.query)

  const { users, total_of_users } = await fetchGroupMembers(group_id, req.headers, limit, skip)

  const user_ids = users.map((user: IUser) => ({ user_id: getUserIdFromUserObj(user) }))
  if (!user_ids.length) throw createHttpError(404, `Group ${group_id} appears to be empty`)

  const result = await getUserArrayAllocationsByYear(user_ids, year)

  const allocations_mapping = result.allocations.reduce((prev: Record<string, any[]>, allocation: any) => {
    if (!prev[allocation.user_id]) prev[allocation.user_id] = []
    prev[allocation.user_id].push(allocation)
    return prev
  }, {})

  const items = users.map((user: IUser) => {
    const user_id = getUserIdFromUserObj(user)
    if (!user_id) throw new Error("User has no ID")
    const allocs = allocations_mapping[user_id] || []
    // TODO: remove "allocatons" once all consumers use "allocations" — kept for backwards compatibility with the original typo
    return { user, allocations: allocs, allocatons: allocs }
  })

  res.send({ year, user_ids, limit, skip, total: total_of_users, items })
}

export const get_single_allocation = async (req: Request, res: Response) => {
  const { _id } = validate(AllocationIdParamsSchema, req.params)
  const allocation = await getAllocation(_id)
  res.send(allocation)
}

export const get_all_allocations = async (req: Request, res: Response) => {
  const params = validate(GetAllAllocationsQuerySchema, req.query)
  const result = await listAllocations(params)
  res.send(result)
}

export const create_allocation = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(AllocationUserParamsSchema, req.params)
  const fields = validate(CreateAllocationBodySchema, req.body)
  const user_id = await getStableUserIdFromParamsUserId(res.locals.user, identifier, req.headers)
  const allocation = await createOrUpdateAllocation(user_id, fields)
  res.send(allocation)
}

export const update_allocation = async (req: Request, res: Response) => {
  const { _id } = validate(AllocationIdParamsSchema, req.params)
  const fields = validate(UpdateAllocationBodySchema, req.body)
  const result = await updateAllocation(_id, fields)
  res.send(result)
}

export const delete_allocation = async (req: Request, res: Response) => {
  const { _id } = validate(AllocationIdParamsSchema, req.params)
  const result = await deleteAllocation(_id)
  res.send(result)
}
