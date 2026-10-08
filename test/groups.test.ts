import request from "supertest"
import { expect } from "chai"
import app from "../index"
import { TEST_GROUP_ID, TEST_JWT } from "./mocks"

describe("/groups without group manager", () => {
  const jwt = TEST_JWT
  let groupManagerApiUrl: string | undefined

  before(() => {
    groupManagerApiUrl = process.env.GROUP_MANAGER_API_URL
    delete process.env.GROUP_MANAGER_API_URL
  })

  after(() => {
    process.env.GROUP_MANAGER_API_URL = groupManagerApiUrl
  })

  it("Should return 501 for the entries of a group", async () => {
    const { status } = await request(app)
      .get(`/groups/${TEST_GROUP_ID}/entries`)
      .set("Authorization", `Bearer ${jwt}`)

    expect(status).to.equal(501)
  })

  it("Should return 501 for the allocations of a group", async () => {
    const { status } = await request(app)
      .get(`/groups/${TEST_GROUP_ID}/allocations`)
      .set("Authorization", `Bearer ${jwt}`)

    expect(status).to.equal(501)
  })
})
