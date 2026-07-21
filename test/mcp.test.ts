import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { expect } from "chai"
import request from "supertest"
import axios from "axios"
import dotenv from "dotenv"
import app from "../index"
import { createMcpServer } from "../mcp"
import IUser from "../interfaces/user"

dotenv.config()

const { LOGIN_URL = "", TEST_USER_USERNAME, TEST_USER_PASSWORD } = process.env

async function login(): Promise<{ jwt: string; user: IUser }> {
  const { data } = await axios.post(LOGIN_URL, {
    username: TEST_USER_USERNAME,
    password: TEST_USER_PASSWORD,
  })
  return data
}

async function connectMcpClient(user: IUser): Promise<Client> {
  const server = createMcpServer(user)
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: "test-client", version: "1.0.0" })
  await client.connect(clientTransport)
  return client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(result: any): string {
  return result.content[0].text as string
}

// A fake user whose user_id will never match any real entry.
// Uses the same identifier fields as the app (IDENTIFIER_FIELDS=id,_id).
const intruder: IUser = {
  id: "mcp-test-intruder-do-not-use",
  _id: "mcp-test-intruder-do-not-use",
  entries: [],
}

describe("MCP Server — ownership enforcement", () => {
  let jwt: string
  let userA: IUser
  let ownerClient: Client
  let intruderClient: Client

  // Entry created by user A in before(); used across multiple describe blocks
  let sharedEntryId: string

  before(async () => {
    const res = await login()
    jwt = res.jwt
    userA = res.user
    console.log("Login successful")

    // Seed an entry owned by user A via the REST API
    const { body } = await request(app)
      .post("/users/self/entries")
      .send({ date: `${new Date().getFullYear()}-11-03` })
      .set("Authorization", `Bearer ${jwt}`)
    sharedEntryId = body._id

    ownerClient = await connectMcpClient(userA)
    intruderClient = await connectMcpClient(intruder)
  })

  after(async () => {
    // Best-effort cleanup in case delete_entry tests did not run
    if (sharedEntryId) {
      await request(app)
        .delete(`/entries/${sharedEntryId}`)
        .set("Authorization", `Bearer ${jwt}`)
    }
  })

  // ─── list_user_entries ──────────────────────────────────────────────────────

  describe("list_user_entries", () => {
    it("should return entries for the authenticated user", async () => {
      const result = await ownerClient.callTool({
        name: "list_user_entries",
        arguments: {},
      })
      expect(result.isError).to.not.equal(true)
      const entries = JSON.parse(textOf(result))
      expect(entries).to.be.an("array")
    })

    it("should not return other users' entries", async () => {
      // The intruder has a unique sub that owns no real entries
      const result = await intruderClient.callTool({
        name: "list_user_entries",
        arguments: {},
      })
      expect(result.isError).to.not.equal(true)
      const entries = JSON.parse(textOf(result))
      expect(entries).to.be.an("array")
      // None of the intruder's listed entries should match the owner's seeded entry
      const ids = entries.map((e: any) => e._id)
      expect(ids).to.not.include(sharedEntryId)
    })
  })

  // ─── get_entry ──────────────────────────────────────────────────────────────

  describe("get_entry", () => {
    it("should allow the owner to fetch their own entry", async () => {
      const result = await ownerClient.callTool({
        name: "get_entry",
        arguments: { _id: sharedEntryId },
      })
      expect(result.isError).to.not.equal(true)
      const entry = JSON.parse(textOf(result))
      expect(entry._id).to.equal(sharedEntryId)
    })

    it("should allow any authenticated user to read an entry by _id (read-only, no ownership check)", async () => {
      // get_entry is intentionally read-only with no ownership guard
      const result = await intruderClient.callTool({
        name: "get_entry",
        arguments: { _id: sharedEntryId },
      })
      expect(result.isError).to.not.equal(true)
      const entry = JSON.parse(textOf(result))
      expect(entry._id).to.equal(sharedEntryId)
    })

    it("should return an error for a non-existent entry", async () => {
      const result = await ownerClient.callTool({
        name: "get_entry",
        arguments: { _id: "000000000000000000000000" },
      })
      expect(result.isError).to.equal(true)
    })
  })

  // ─── create_entry ───────────────────────────────────────────────────────────

  describe("create_entry", () => {
    let mcpCreatedEntryId: string

    after(async () => {
      if (mcpCreatedEntryId) {
        await request(app)
          .delete(`/entries/${mcpCreatedEntryId}`)
          .set("Authorization", `Bearer ${jwt}`)
      }
    })

    it("should create an entry attributed to the session user, ignoring any attempt to set a different user_id", async () => {
      const result = await ownerClient.callTool({
        name: "create_entry",
        arguments: { date: `${new Date().getFullYear()}-11-10` },
      })
      expect(result.isError).to.not.equal(true)
      const entry = JSON.parse(textOf(result))
      mcpCreatedEntryId = entry._id
      expect(entry._id).to.be.a("string")

      // Verify via REST that the created entry belongs to user A
      const { body } = await request(app)
        .get(`/entries/${entry._id}`)
        .set("Authorization", `Bearer ${jwt}`)
      expect(body.user_id).to.be.a("string").and.not.equal(intruder.sub)
    })

    it("should not allow creating an entry without a date", async () => {
      const result = await ownerClient.callTool({
        name: "create_entry",
        arguments: {},
      })
      // MCP SDK validation should reject missing required field
      expect(result.isError).to.equal(true)
    })
  })

  // ─── update_entry ───────────────────────────────────────────────────────────

  describe("update_entry", () => {
    it("should reject an update attempt by a user who does not own the entry", async () => {
      const result = await intruderClient.callTool({
        name: "update_entry",
        arguments: { _id: sharedEntryId, taken: true },
      })
      expect(result.isError).to.equal(true)
      expect(textOf(result)).to.include("Could not find entry")
    })

    it("should return an error when the entry does not exist", async () => {
      const result = await ownerClient.callTool({
        name: "update_entry",
        arguments: { _id: "000000000000000000000000", taken: true },
      })
      expect(result.isError).to.equal(true)
    })

    it("should allow the owner to update their own entry", async () => {
      const result = await ownerClient.callTool({
        name: "update_entry",
        arguments: { _id: sharedEntryId, taken: true },
      })
      expect(result.isError).to.not.equal(true)
    })
  })

  // ─── delete_entry ───────────────────────────────────────────────────────────

  describe("delete_entry", () => {
    it("should reject a delete attempt by a user who does not own the entry", async () => {
      const result = await intruderClient.callTool({
        name: "delete_entry",
        arguments: { _id: sharedEntryId },
      })
      expect(result.isError).to.equal(true)
      expect(textOf(result)).to.include("Could not find entry")
    })

    it("should return an error when the entry does not exist", async () => {
      const result = await ownerClient.callTool({
        name: "delete_entry",
        arguments: { _id: "000000000000000000000000" },
      })
      expect(result.isError).to.equal(true)
    })

    it("should allow the owner to delete their own entry", async () => {
      const result = await ownerClient.callTool({
        name: "delete_entry",
        arguments: { _id: sharedEntryId },
      })
      expect(result.isError).to.not.equal(true)
      sharedEntryId = "" // Prevent after() from double-deleting
    })
  })
})
