import { z } from "zod"
import { DEFAULT_BATCH_SIZE } from "../constants"

// ─── Params ───────────────────────────────────────────────────────────────────

export const AllocationUserParamsSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
})

export const AllocationIdParamsSchema = z.object({
  _id: z.string().min(1, "_id is required"),
})

export const AllocationGroupParamsSchema = z.object({
  group_id: z.string().min(1, "group_id is required"),
})

// ─── Query ────────────────────────────────────────────────────────────────────
export const GetAllocationsOfUserQuerySchema = z.object({
  year: z.coerce.number().optional(),
})

export const GetAllocationsOfGroupQuerySchema = z.object({
  year: z.coerce.number().default(new Date().getFullYear()),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE),
  skip: z.coerce.number().default(0),
})

export const GetAllAllocationsQuerySchema = z.object({
  year: z.coerce.number().optional(),
  user_id: z.string().optional(),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE),
  skip: z.coerce.number().default(0),
})

// ─── Body ─────────────────────────────────────────────────────────────────────
const LeaveGrantSchema = z.object({
  current_year_grants: z.coerce.number().default(0),
  carried_over: z.coerce.number().default(0),
})

const LeaveGrantWithTargetSchema = LeaveGrantSchema.extend({
  target: z.coerce.number().optional(),
})

export const CreateAllocationBodySchema = z.object({
  year: z.coerce.number({ error: "year is required" }),
  leaves: LeaveGrantWithTargetSchema.default({
    current_year_grants: 0,
    carried_over: 0,
  }),
  reserve: LeaveGrantSchema.default({
    current_year_grants: 0,
    carried_over: 0,
  }),
})
