import { z } from "zod"
import { DEFAULT_BATCH_SIZE } from "../constants"

// ─── Params ───────────────────────────────────────────────────────────────────

export const EntryUserParamsSchema = z.object({
  user_id: z.string().min(1, "user_id is required").describe("User ID"),
})

export const EntryIdParamsSchema = z.object({
  _id: z.string().min(1, "_id is required").describe("MongoDB ObjectId of the entry"),
})

export const EntryGroupParamsSchema = z.object({
  group_id: z.string().min(1, "group_id is required").describe("Group ID"),
})

export const EntryWorkplaceParamsSchema = z.object({
  workplace_id: z.string().min(1, "workplace_id is required").describe("Workplace ID"),
})

// ─── Query ────────────────────────────────────────────────────────────────────

export const GetEntriesOfUserQuerySchema = z.object({
  year: z.coerce.number().optional().describe("Year to filter (defaults to current year)"),
  start_date: z.string().optional().describe("Start date ISO string (overrides year)"),
  end_date: z.string().optional().describe("End date ISO string (overrides year)"),
})

export const GetAllEntriesQuerySchema = z.object({
  year: z.coerce.number().default(new Date().getFullYear()).describe("Year to filter (defaults to current year)"),
  start_date: z.string().optional().describe("Start date ISO string (overrides year)"),
  end_date: z.string().optional().describe("End date ISO string (overrides year)"),
  user_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined
      return Array.isArray(val) ? val : val.split(",")
    })
    .describe("Filter by specific user IDs (comma-separated or array)"),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE).describe("Max results to return"),
  skip: z.coerce.number().default(0).describe("Number of results to skip (pagination offset)"),
})

export const GetEntriesOfGroupQuerySchema = z.object({
  year: z.coerce.number().default(new Date().getFullYear()).describe("Year to filter (defaults to current year)"),
  start_date: z.string().optional().describe("Start date ISO string (overrides year)"),
  end_date: z.string().optional().describe("End date ISO string (overrides year)"),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE).describe("Max results to return"),
  skip: z.coerce.number().default(0).describe("Number of results to skip (pagination offset)"),
})

export const DeleteEntriesQuerySchema = z.object({
  ids: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : val.split(",")))
    .refine((arr) => arr.length > 0, { message: "_id not provided" })
    .describe("Entry IDs to delete (comma-separated or array)"),
})

// ─── Body ─────────────────────────────────────────────────────────────────────

export const CreateEntryBodySchema = z.object({
  date: z.string({ error: "date is required" }).describe("Date of the entry (ISO string)"),
  type: z.string().default("有休").describe("Leave type (e.g. 有休, 前半休, 後半休)"),
  am: z.coerce.boolean().default(true).describe("Morning half-day flag"),
  pm: z.coerce.boolean().default(true).describe("Afternoon half-day flag"),
  taken: z.coerce.boolean().default(false).describe("Whether the leave was taken"),
  refresh: z.coerce.boolean().default(false).describe("Refresh leave flag"),
  plus_one: z.coerce.boolean().default(false).describe("Plus-one leave flag"),
  reserve: z.coerce.boolean().default(false).describe("Reserved leave flag"),
})

export const CreateEntriesBodySchema = z.array(
  z.object({
    user_id: z.string({ error: "user_id is required" }).describe("User ID"),
    date: z.string({ error: "date is required" }).describe("Date of the entry (ISO string)"),
  })
)

export const UpdateEntryBodySchema = z.object({
  date: z.string().optional().describe("Date of the entry (ISO string)"),
  type: z.string().optional().describe("Leave type (e.g. 有休, 前半休, 後半休)"),
  am: z.coerce.boolean().optional().describe("Morning half-day flag"),
  pm: z.coerce.boolean().optional().describe("Afternoon half-day flag"),
  taken: z.coerce.boolean().optional().describe("Whether the leave was taken"),
  refresh: z.coerce.boolean().optional().describe("Refresh leave flag"),
  plus_one: z.coerce.boolean().optional().describe("Plus-one leave flag"),
  reserve: z.coerce.boolean().optional().describe("Reserved leave flag"),
})

export const UpdateEntriesBodySchema = z.array(
  z.object({
    _id: z.string({ error: "_id is required" }).describe("MongoDB ObjectId of the entry"),
    type: z.string({ error: "type is required" }).describe("Leave type (e.g. 有休)"),
  })
)
