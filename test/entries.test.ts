import request from "supertest"
import { expect } from "chai"
import app from "../index"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const {
  LOGIN_URL = "",
  IDENTIFICATION_URL = "",
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} = process.env

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD }
  const { data } = await axios.post(LOGIN_URL, body)

  return data
}

describe("/entries", () => {
  let jwt: string, user, entry_id: string

  before(async () => {
    // Silencing console
    //console.log = () => {}
    const res: any = await login()
    jwt = res.jwt
    user = res.user
  })

  describe("POST /users/self/entries", () => {
    it("Should allow the creation of an entry", async () => {
      const { status, body } = await request(app)
        .post(`/users/self/entries`)
        .send({ date: `${new Date().getFullYear()}-01-01` })
        .set("Authorization", `Bearer ${jwt}`)

      entry_id = body._id

      expect(status).to.equal(200)
    })

    it("Should prevent the creation of an entry without date", async () => {
      const { status } = await request(app)
        .post(`/users/self/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(400)
    })

    it("Should prevent the creation of an entry for anonymous users", async () => {
      const { status } = await request(app).post(`/users/self/entries`)

      expect(status).to.equal(403)
    })
  })

  describe("GET /users/:user_id/entries", () => {
    it("Should allow the query of entries of a user", async () => {
      const { status, body } = await request(app)
        .get(`/users/self/entries`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body).to.have.lengthOf.above(0)
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

  describe("PATCH /entries/:entry_id", () => {
    it("Should allow the update of an entry", async () => {
      const { status, body } = await request(app)
        .patch(`/entries/${entry_id}`)
        .send({ taken: true })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
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