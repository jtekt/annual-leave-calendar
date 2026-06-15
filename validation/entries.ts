import { z } from "zod"
import { DEFAULT_BATCH_SIZE } from "../constants"

// ─── Params ───────────────────────────────────────────────────────────────────

export const EntryUserParamsSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
})

export const EntryIdParamsSchema = z.object({
  _id: z.string().min(1, "_id is required"),
})

export const EntryGroupParamsSchema = z.object({
  group_id: z.string().min(1, "group_id is required"),
})

export const EntryWorkplaceParamsSchema = z.object({
  workplace_id: z.string().min(1, "workplace_id is required"),
})

// ─── Query ────────────────────────────────────────────────────────────────────

export const GetEntriesOfUserQuerySchema = z.object({
  year: z.coerce.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const GetAllEntriesQuerySchema = z.object({
  year: z.coerce.number().default(new Date().getFullYear()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined
      return Array.isArray(val) ? val : val.split(",")
    }),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE),
  skip: z.coerce.number().default(0),
})

export const GetEntriesOfGroupQuerySchema = z.object({
  year: z.coerce.number().default(new Date().getFullYear()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.coerce.number().default(DEFAULT_BATCH_SIZE),
  skip: z.coerce.number().default(0),
})

export const DeleteEntriesQuerySchema = z.object({
  ids: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : val.split(",")))
    .refine((arr) => arr.length > 0, { message: "_id not provided" }),
})

// ─── Body ─────────────────────────────────────────────────────────────────────

export const CreateEntryBodySchema = z.object({
  date: z.string({ error: "date is required" }),
  type: z.string().default("有休"),
  am: z.coerce.boolean().default(true),
  pm: z.coerce.boolean().default(true),
  taken: z.coerce.boolean().default(false),
  refresh: z.coerce.boolean().default(false),
  plus_one: z.coerce.boolean().default(false),
  reserve: z.coerce.boolean().default(false),
})

export const CreateEntriesBodySchema = z.array(
  z.object({
    user_id: z.string({ error: "user_id is required" }),
    date: z.string({ error: "date is required" }),
  })
)

export const UpdateEntriesBodySchema = z.array(
  z.object({
    _id: z.string({ error: "_id is required" }),
    type: z.string({ error: "type is required" }),
  })
)
