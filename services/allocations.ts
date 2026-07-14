import { z } from "zod"
import createHttpError from "http-errors"
import Allocation from "../models/allocation"
import { DEFAULT_BATCH_SIZE } from "../constants"
import {
  CreateAllocationBodySchema,
  GetAllAllocationsQuerySchema,
  GetAllocationsOfUserQuerySchema,
  UpdateAllocationBodySchema,
} from "../validation/allocations"

export async function getAllocation(id: string) {
  return Allocation.findById(id)
}

export async function listAllocations(
  params: z.infer<typeof GetAllAllocationsQuerySchema>
) {
  const { year, user_id, limit, skip } = params
  const numericLimit = Math.max(limit, 0)

  const query: Record<string, string | number> = {}
  if (year) query.year = year
  if (user_id) query.user_id = user_id

  const [allocations, total] = await Promise.all([
    Allocation.find(query).sort({ user_id: 1, year: 1 }).skip(skip).limit(numericLimit),
    Allocation.countDocuments(query),
  ])

  return { year, user_id, limit: numericLimit, skip, total, allocations }
}

export async function listAllocationsOfUser(
  user_id: string,
  params: z.infer<typeof GetAllocationsOfUserQuerySchema>
) {
  const { year } = params
  const query: Record<string, any> = { user_id }
  if (year) query.year = year
  return Allocation.find(query).sort("year")
}

export async function getUserAllocationByYear(user_id: string, year: number) {
  if (!user_id) throw createHttpError(400, "User ID not provided")
  if (!year) throw createHttpError(400, "Year not provided")

  return Allocation.findOne({ year, user_id })
    .skip(0)
    .limit(Math.max(DEFAULT_BATCH_SIZE, 0))
}

export async function getUserArrayAllocationsByYear(
  user_ids: { user_id: string | undefined }[],
  year: number
) {
  if (!user_ids?.length) throw createHttpError(400, "No User IDs found in the provided array")
  if (!year) throw createHttpError(400, "Year not provided")

  const query: Record<string, any> = { year, $or: user_ids }

  const [allocations, total] = await Promise.all([
    Allocation.find(query).skip(0).limit(Math.max(DEFAULT_BATCH_SIZE, 0)),
    Allocation.countDocuments(query),
  ])

  return { year, user_ids, limit: DEFAULT_BATCH_SIZE, skip: 0, total, allocations }
}

export async function createOrUpdateAllocation(
  user_id: string,
  fields: z.infer<typeof CreateAllocationBodySchema>
) {
  const { year, leaves, reserve } = fields
  const filter = { year, user_id }
  const update = { year, user_id, leaves, reserve }
  return Allocation.findOneAndUpdate(filter, update, { new: true, upsert: true })
}

export async function updateAllocation(
  id: string,
  fields: z.infer<typeof UpdateAllocationBodySchema>
) {
  return Allocation.updateOne({ _id: id }, { $set: fields })
}

export async function deleteAllocation(id: string) {
  return Allocation.deleteOne({ _id: id })
}
