import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { getEntry, updateEntry, deleteEntry, createEntry, listEntriesOfUser } from "./services/entries"
import {
  CreateEntryBodySchema,
  EntryIdParamsSchema,
  GetEntriesOfUserQuerySchema,
  UpdateEntryBodySchema,
} from "./validation/entries"
import { getUserIdFromUserObj } from "./utils"
import IUser from "./interfaces/user"

export function createMcpServer(user: IUser) {
  const server = new McpServer({ name: "nenkyuu-calendar", version: "0.0.1" })

  // get_entry — by _id, no user context needed
  server.registerTool(
    "get_entry",
    {
      title: "Get Entry",
      description: "Get a single calendar entry by its _id",
      inputSchema: EntryIdParamsSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ _id }) => {
      const entry = await getEntry(_id)
      if (!entry) return { content: [{ type: "text", text: "Entry not found" }], isError: true }
      return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] }
    }
  )

  // list_user_entries — shared query schema, user_ids filter is optional for admins
  server.registerTool(
    "list_user_entries",
    {
      title: "List User Entries",
      description: "List calendar entries for the authenticated user with optional date range",
      inputSchema: GetEntriesOfUserQuerySchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (params) => {
      const result = await listEntriesOfUser(getUserIdFromUserObj(user), params)
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    },
  )

  // create_entry — user_id is taken from the authenticated session, not from input
  server.registerTool(
    "create_entry",
    {
      title: "Create Entry",
      description: "Create or update a calendar entry for the authenticated user on a given date",
      inputSchema: CreateEntryBodySchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (fields) => {
      const user_id = getUserIdFromUserObj(user)
      if (!user_id) return { content: [{ type: "text", text: "Could not resolve user ID from session" }], isError: true }
      const entry = await createEntry(user_id, fields)
      return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] }
    }
  )

  // update_entry — _id + any fields to update
  server.registerTool(
    "update_entry",
    {
      title: "Update Entry",
      description: "Update fields of a calendar entry by _id",
      inputSchema: {
        ...EntryIdParamsSchema.shape,
        ...UpdateEntryBodySchema.shape,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ _id, ...fields }) => {
      const user_id = getUserIdFromUserObj(user)
      if (!user_id) return { content: [{ type: "text", text: "Could not resolve user ID from session" }], isError: true }

      const entry = await getEntry(_id)
      if(!entry || entry.user_id !== user_id) return { content: [{ type: "text", text: "Could not find entry" }], isError: true }

      const result = await updateEntry(_id, fields)
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    }
  )

  // delete_entry — by _id
  server.registerTool(
    "delete_entry",
    {
      title: "Delete Entry",
      description: "Delete a calendar entry by its _id",
      inputSchema: EntryIdParamsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ _id }) => {
      const user_id = getUserIdFromUserObj(user)
      if (!user_id) return { content: [{ type: "text", text: "Could not resolve user ID from session" }], isError: true }

      const entry = await getEntry(_id)
      if(!entry || entry.user_id !== user_id) return { content: [{ type: "text", text: "Could not find entry" }], isError: true }
      
      const result = await deleteEntry(_id)
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    }
  )

  return server
}
