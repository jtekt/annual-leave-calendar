import request from "supertest"
import { expect } from "chai"
import app from "../index"
import { TEST_GROUP_ID, TEST_JWT } from "./mocks"

describe("/allocations", () => {
  const jwt = TEST_JWT
  let allocation_id: string

  describe("POST /users/self/allocations", () => {
    it("Should allow the creation of an allocation", async () => {
      const { status, body } = await request(app)
        .post(`/users/self/allocations`)
        .send({
          year: new Date().getFullYear(),
          leaves: { current_year_grants: 20, carried_over: 5 },
          reserve: { current_year_grants: 2, carried_over: 0 },
        })
        .set("Authorization", `Bearer ${jwt}`)

      allocation_id = body._id

      expect(status).to.equal(200)
    })

    it("Should prevent the creation of an allocation without year", async () => {
      const { status } = await request(app)
        .post(`/users/self/allocations`)
        .send({
          leaves: { current_year_grants: 20, carried_over: 5 },
          reserve: { current_year_grants: 2, carried_over: 0 },
        })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(400)
    })

    it("Should prevent the creation of an allocation for anonymous users", async () => {
      const { status } = await request(app).post(`/users/self/allocations`)

      expect(status).to.equal(401)
    })
  })

  describe("GET /allocations/:allocation_id", () => {
    it("Should allow the query of an allocation", async () => {
      const { status } = await request(app)
        .get(`/allocations/${allocation_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /allocations", () => {
    it("Should allow the query of all allocations", async () => {
      const { status } = await request(app)
        .get(`/allocations`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /users/:user_id/allocations", () => {
    it("Should allow the query of allocations of a user", async () => {
      const { status } = await request(app)
        .get(`/users/self/allocations`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /groups/:group_id/allocations", () => {
    it("Should return allocations under the correct key with no legacy typo key", async () => {
      const { status, body } = await request(app)
        .get(`/groups/${TEST_GROUP_ID}/allocations`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.items).to.be.an("array")
      body.items.forEach((item: any) => {
        expect(item).to.have.property("allocations")
        expect(item).to.not.have.property("allocatons")
      })
    })
  })

  describe("PATCH /allocations/:allocation_id", () => {
    it("Should allow the update of an allocation", async () => {
      const { status } = await request(app)
        .patch(`/allocations/${allocation_id}`)
        .send({ leaves: { current_year_grants: 22, carried_over: 3 } })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /allocations/:allocation_id", () => {
    it("Should allow the deletion of an allocation", async () => {
      const { status } = await request(app)
        .delete(`/allocations/${allocation_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })
})
