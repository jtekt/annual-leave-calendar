import request from "supertest"
import { expect } from "chai"
import app from "../index"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const {
  LOGIN_URL = "",
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
  TEST_GROUP_ID,
  TEST_WORKPLACE_ID,
} = process.env

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD }
  const { data } = await axios.post(LOGIN_URL, body)

  return data
}

describe("V3 Legacy test", () => {
  let jwt: string, user, entry_id: string

  before(async () => {
    // Silencing console
    //console.log = () => {}
    const res: any = await login()
    jwt = res.jwt
    user = res.user
    console.log("Login successful")
  })

  describe("POST /v3/users/:identifier/entries", () => {
    it("Should allow the creation of an entry with user_id and oidc_user_identifier", async () => {
      const { status, body } = await request(app)
        .post(`/v3/users/self/entries`)
        .send({ date: `${new Date().getFullYear()}-01-01` })
        .set("Authorization", `Bearer ${jwt}`)

      entry_id = body._id
      expect(status).to.equal(200)
      expect(body).to.have.property("user_id").that.is.a("string").and.is.not.empty
      expect(body).to.have.property("oidc_user_identifier").that.is.a("string").and.is.not.empty
    })

    it("Should prevent the creation of an entry for anonymous users", async () => {
      const { status } = await request(app).post(`/v3/users/self/entries`)

      expect(status).to.equal(403)
    })
  })

  describe("GET /v3/users/:identifier/entries", () => {
    it("Should allow the query of entries of a user", async () => {
      const { status, body } = await request(app)
        .get(`/v3/users/self/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      console.log("body", body)

      expect(status).to.equal(200)
      expect(body.entries).to.have.lengthOf.above(0)
    })
  })

  describe("GET /v3/groups/:group_id/entries", () => {
    it("Should allow the query of an entry", async () => {
      const { status } = await request(app)
        .get(`/v3/groups/${TEST_GROUP_ID}/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should return an error if wrong group_id is specified", async () => {
      const { status } = await request(app)
        .get(`/v3/groups/wrong_id/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })
  })

  describe("GET /v3/workplaces/:workplace_id/entries", () => {
    it("Should allow the query of an entry", async () => {
      const { status } = await request(app)
        .get(`/v3/workplaces/${TEST_WORKPLACE_ID}/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should return an error if wrong workplace_id is specified", async () => {
      const { status } = await request(app)
        .get(`/v3/workplaces/wrong_id/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
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
