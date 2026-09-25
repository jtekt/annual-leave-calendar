import request from "supertest"
import { expect } from "chai"
import app from "../index"
import { TEST_GROUP_ID, TEST_JWT, TEST_WORKPLACE_ID } from "./mocks"

describe("/entries", () => {
  const jwt = TEST_JWT
  let entry_id: string

  describe("POST /users/self/entries", () => {
    it("Should allow the creation of an entry", async () => {
      const { status, body } = await request(app)
        .post(`/users/self/entries`)
        .send({ date: `${new Date().getFullYear()}-03-01` })
        .set("Authorization", `Bearer ${jwt}`)

      entry_id = body._id

      expect(status).to.equal(200)
    })

    it("Should prevent the creation of an entry without data", async () => {
      const { status } = await request(app)
        .post(`/users/self/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(400)
    })

    it("Should prevent the creation of an entry for anonymous users", async () => {
      const { status } = await request(app).post(`/users/self/entries`)

      expect(status).to.equal(401)
    })
  })

  describe("GET /entries/:entry_id", () => {
    it("Should allow the query of an entry", async () => {
      const { status } = await request(app)
        .get(`/entries/${entry_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /users/:user_id/entries", () => {
    it("Should allow the query of entries of a user", async () => {
      const { status, body } = await request(app)
        .get(`/users/self/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /groups/:group_id/entries", () => {
    it("Should allow the query of an entry", async () => {
      const { status } = await request(app)
        .get(`/groups/${TEST_GROUP_ID}/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should return an error if wrong group_id is specified", async () => {
      const { status } = await request(app)
        .get(`/groups/wrong_id/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })

    it("Should return entries only at item.entries, not duplicated on user object", async () => {
      const { status, body } = await request(app)
        .get(`/groups/${TEST_GROUP_ID}/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.items).to.be.an("array")
      body.items.forEach((item: any) => {
        expect(item.entries).to.be.an("array")
        expect(item.user.entries).to.be.undefined
      })
    })
  })

  describe("GET /workplaces/:workplace_id/entries", () => {
    it("Should allow the query of an entry", async () => {
      const { status } = await request(app)
        .get(`/workplaces/${TEST_WORKPLACE_ID}/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should return an error if wrong workplace_id is specified", async () => {
      const { status } = await request(app)
        .get(`/workplaces/wrong_id/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })
  })

  describe("PATCH /entries/:entry_id", () => {
    it("Should allow the update of an entry", async () => {
      const { status, body } = await request(app)
        .patch(`/entries/${entry_id}`)
        .send({ taken: true })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should not nullify date when patching a field other than date", async () => {
      const { body: before } = await request(app)
        .get(`/entries/${entry_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      await request(app)
        .patch(`/entries/${entry_id}`)
        .send({ taken: true })
        .set("Authorization", `Bearer ${jwt}`)

      const { body: after } = await request(app)
        .get(`/entries/${entry_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(after.date).to.equal(before.date)
      expect(after.date).to.not.be.null
    })

    it("Should update date when a new date is provided", async () => {
      const newDate = `${new Date().getFullYear()}-06-15`

      await request(app)
        .patch(`/entries/${entry_id}`)
        .send({ date: newDate })
        .set("Authorization", `Bearer ${jwt}`)

      const { body } = await request(app)
        .get(`/entries/${entry_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(new Date(body.date).toISOString().startsWith(`${new Date().getFullYear()}-06-15`)).to.be.true
    })
  })

  describe("DELETE /entries/:entry_id", () => {
    it("Should allow the deletion of entry", async () => {
      const { status, body } = await request(app)
        .delete(`/entries/${entry_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })
})
