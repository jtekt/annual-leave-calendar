import createHttpError from "http-errors"
import { getStableUserIdFromParamsUserId } from "../../utils"
import { validate } from "../../utils/validate"
import { Request, Response } from "express"
import {
  EntryUserParamsSchema,
  EntryIdParamsSchema,
  EntryGroupParamsSchema,
  EntryWorkplaceParamsSchema,
  GetEntriesOfUserQuerySchema,
  GetAllEntriesQuerySchema,
  GetEntriesOfGroupQuerySchema,
  DeleteEntriesQuerySchema,
  CreateEntryBodySchema,
  CreateEntriesBodySchema,
  UpdateEntriesBodySchema,
  UpdateEntryBodySchema,
} from "../../validation/entries"
import {
  getEntry,
  listEntries,
  listEntriesOfUser,
  createEntry,
  createEntries,
  updateEntry,
  updateEntries,
  deleteEntry,
  deleteEntries,
  listEntriesOfGroup,
} from "../../services/entries"
import { fetchGroupMembers, fetchWorkplaceEmployees } from "../../services/members"

function get_current_user(res: Response) {
  return res.locals.user
}

export const get_entries_of_user = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(EntryUserParamsSchema, req.params)
  const params = validate(GetEntriesOfUserQuerySchema, req.query)
  const user_id = await getStableUserIdFromParamsUserId(get_current_user(res), identifier, req.headers)
  const entries = await listEntriesOfUser(user_id, params)
  res.send(entries)
}

export const get_single_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)
  const entry = await getEntry(_id)
  res.send(entry)
}

export const get_all_entries = async (req: Request, res: Response) => {
  const params = validate(GetAllEntriesQuerySchema, req.query)
  const result = await listEntries(params)
  res.send(result)
}

export const create_entry = async (req: Request, res: Response) => {
  const { user_id: identifier } = validate(EntryUserParamsSchema, req.params)
  const fields = validate(CreateEntryBodySchema, req.body)
  const user_id = await getStableUserIdFromParamsUserId(get_current_user(res), identifier, req.headers)
  const entry = await createEntry(user_id, fields)
  res.send(entry)
}

export const create_entries = async (req: Request, res: Response) => {
  const entries = validate(CreateEntriesBodySchema, req.body)
  const result = await createEntries(entries)
  res.send(result)
}

export const update_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)
  const fields = validate(UpdateEntryBodySchema, req.body)
  const result = await updateEntry(_id, fields)
  res.send(result)
}

export const update_entries = async (req: Request, res: Response) => {
  const entries = validate(UpdateEntriesBodySchema, req.body)
  const result = await updateEntries(entries)
  res.send(result)
}

export const delete_entry = async (req: Request, res: Response) => {
  const { _id } = validate(EntryIdParamsSchema, req.params)
  const result = await deleteEntry(_id)
  res.send(result)
}

export const delete_entries = async (req: Request, res: Response) => {
  const { ids } = validate(DeleteEntriesQuerySchema, req.query)
  const result = await deleteEntries(ids)
  res.send(result)
}

export const get_entries_of_group = async (req: Request, res: Response) => {
  const { group_id } = validate(EntryGroupParamsSchema, req.params)
  const { year, start_date, end_date, limit, skip } = validate(GetEntriesOfGroupQuerySchema, req.query)
  const { users, total_of_users } = await fetchGroupMembers(group_id, req.headers, limit, skip)
  if (!users.length) throw createHttpError(404, `Group ${group_id} appears to be empty`)
  const result = await listEntriesOfGroup(users, total_of_users, year, start_date, end_date, limit, skip)
  res.send(result)
}

export const get_entries_of_workplace = async (req: Request, res: Response) => {
  const { workplace_id } = validate(EntryWorkplaceParamsSchema, req.params)
  const { year, start_date, end_date, limit, skip } = validate(GetEntriesOfGroupQuerySchema, req.query)
  const { users, total_of_users } = await fetchWorkplaceEmployees(workplace_id, req.headers, limit, skip)
  if (!users.length) throw createHttpError(404, `Workplace ${workplace_id} appears to be empty`)
  const result = await listEntriesOfGroup(users, total_of_users, year, start_date, end_date, limit, skip)
  res.send(result)
}
