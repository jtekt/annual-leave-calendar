import request from "supertest"
import { expect } from "chai"
import app from "../index"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const { LOGIN_URL = "", TEST_USER_USERNAME, TEST_USER_PASSWORD } = process.env

const login = async () => {
  const body = { username: TEST_USER_USERNAME, password: TEST_USER_PASSWORD }
  const { data } = await axios.post(LOGIN_URL, body)
  return data
}

/**
 * CalDAV clients send Authorization: Basic base64(username:jwt)
 * The caldavMiddleware extracts the JWT from the password field.
 */
const basicAuthHeader = (username: string, jwt: string): string => {
  const encoded = Buffer.from(`${username}:${jwt}`).toString("base64")
  return `Basic ${encoded}`
}

// Minimal PROPFIND body requesting a known property
const PROPFIND_CURRENT_USER_PRINCIPAL = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>`

const PROPFIND_CALENDAR_HOME_SET = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <C:calendar-home-set/>
    <D:principal-URL/>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>`

const PROPFIND_ALLPROP = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:allprop/>
</D:propfind>`

const REPORT_CALENDAR_MULTIGET = (collHref: string, filename: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <D:href>${collHref}${filename}</D:href>
</C:calendar-multiget>`

const REPORT_SYNC_COLLECTION = (syncToken: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<D:sync-collection xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:sync-token>${syncToken}</D:sync-token>
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
</D:sync-collection>`

const REPORT_CALENDAR_QUERY = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
</C:calendar-query>`

const SAMPLE_ICAL = (dateStr: string, summary = "有休") =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n"

// ─────────────────────────────────────────────────────────────────────────────

describe("/caldav", () => {
  let jwt: string
  let username: string
  let encodedUser: string
  let basicAuth: string
  let createdFilename: string

  before(async () => {
    const res: any = await login()
    jwt = res.jwt
    username = res.user?._id ?? TEST_USER_USERNAME ?? ""
    encodedUser = encodeURIComponent(username)
    basicAuth = basicAuthHeader(username, jwt)
    console.log("Login successful")
  })

  // ─── OPTIONS ──────────────────────────────────────────────────────────────

  describe("OPTIONS /caldav/", () => {
    it("Should return 204 with DAV headers", async () => {
      const { status, headers } = await request(app)
        .options("/caldav/")
        .set("Authorization", basicAuth)

      expect(status).to.equal(204)
      expect(headers["dav"]).to.include("calendar-access")
      expect(headers["allow"]).to.include("PROPFIND")
    })

    it("Should return 204 without authentication (OPTIONS is pre-auth)", async () => {
      const { status } = await request(app).options("/caldav/")
      expect(status).to.equal(204)
    })
  })

  // ─── Well-known redirect ──────────────────────────────────────────────────

  describe("GET /.well-known/caldav", () => {
    it("Should redirect to /caldav/", async () => {
      const { status, headers } = await request(app).get("/.well-known/caldav")
      expect(status).to.equal(301)
      expect(headers["location"]).to.equal("/caldav/")
    })
  })

  // ─── Root PROPFIND (/caldav/) ─────────────────────────────────────────────

  describe("PROPFIND /caldav/", () => {
    it("Should return 207 with current-user-principal href", async () => {
      const { status, text } = await request(app)
        .propfind("/caldav/")
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_CURRENT_USER_PRINCIPAL)

      expect(status).to.equal(207)
      expect(text).to.include("current-user-principal")
      expect(text).to.include(`/caldav/principals/`)
    })

    it("Should return 207 with allprop", async () => {
      const { status, text } = await request(app)
        .propfind("/caldav/")
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(207)
      expect(text).to.include("multistatus")
    })

    it("Should return 207 even with empty body (defaults to allprop)", async () => {
      const { status, text } = await request(app)
        .propfind("/caldav/")
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")

      expect(status).to.equal(207)
      expect(text).to.include("multistatus")
    })

    it("Should include the encoded user identifier in the principal href", async () => {
      const { text } = await request(app)
        .propfind("/caldav/")
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_CURRENT_USER_PRINCIPAL)

      expect(text).to.include(encodedUser)
    })

    it("Should respond with XML Content-Type", async () => {
      const { headers } = await request(app)
        .propfind("/caldav/")
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_CURRENT_USER_PRINCIPAL)

      expect(headers["content-type"]).to.include("application/xml")
    })
  })

  // ─── Principals PROPFIND (/caldav/principals/:user/) ─────────────────────

  describe("PROPFIND /caldav/principals/:user/", () => {
    it("Should return 207 with calendar-home-set for the authenticated user", async () => {
      const { status, text } = await request(app)
        .propfind(`/caldav/principals/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_CALENDAR_HOME_SET)

      expect(status).to.equal(207)
      expect(text).to.include("calendar-home-set")
      expect(text).to.include(`/caldav/calendars/${encodedUser}/`)
    })

    it("Should include principal-URL in the response", async () => {
      const { text } = await request(app)
        .propfind(`/caldav/principals/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_CALENDAR_HOME_SET)

      expect(text).to.include("principal-URL")
      expect(text).to.include(`/caldav/principals/${encodedUser}/`)
    })

    it("Should return 404 for unknown properties", async () => {
      const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:no-such-property/>
  </D:prop>
</D:propfind>`

      const { status, text } = await request(app)
        .propfind(`/caldav/principals/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(body)

      expect(status).to.equal(207)
      expect(text).to.include("404 Not Found")
    })
  })

  // ─── Calendar collection PROPFIND (/caldav/calendars/:user/) ─────────────

  describe("PROPFIND /caldav/calendars/:user/", () => {
    it("Should return 207 with collection properties for the authenticated user", async () => {
      const { status, text } = await request(app)
        .propfind(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .set("Depth", "0")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(207)
      expect(text).to.include("getctag")
      expect(text).to.include("sync-token")
      expect(text).to.include("resourcetype")
    })

    it("Should return 207 with Depth: 1 listing event hrefs", async () => {
      const { status, text } = await request(app)
        .propfind(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .set("Depth", "1")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(207)
      expect(text).to.include("multistatus")
    })

    it("Should return 403 when accessing another user's calendar", async () => {
      const { status } = await request(app)
        .propfind(`/caldav/calendars/other-user/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .set("Depth", "0")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(403)
    })
  })

  // ─── REPORT (/caldav/calendars/:user/) ───────────────────────────────────

  describe("REPORT /caldav/calendars/:user/", () => {
    it("Should return 207 for a calendar-query report", async () => {
      const { status, text } = await request(app)
        .report(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(REPORT_CALENDAR_QUERY)

      expect(status).to.equal(207)
      expect(text).to.include("multistatus")
    })

    it("Should return 403 for calendar-query against another user", async () => {
      const { status } = await request(app)
        .report(`/caldav/calendars/other-user/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(REPORT_CALENDAR_QUERY)

      expect(status).to.equal(403)
    })

    it("Should return 207 for a sync-collection report with up-to-date token (empty diff)", async () => {
      // First get the current ctag
      const propfindRes = await request(app)
        .propfind(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .set("Depth", "0")
        .send(PROPFIND_ALLPROP)

      const ctagMatch = propfindRes.text.match(
        /<CS:getctag>([^<]+)<\/CS:getctag>/
      )
      const ctag = ctagMatch ? ctagMatch[1] : "unknown-token"

      const { status, text } = await request(app)
        .report(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(REPORT_SYNC_COLLECTION(ctag))

      expect(status).to.equal(207)
      expect(text).to.include("sync-token")
    })

    it("Should return all events for a sync-collection report with stale token", async () => {
      const { status, text } = await request(app)
        .report(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(REPORT_SYNC_COLLECTION("stale-token-that-does-not-match"))

      expect(status).to.equal(207)
      expect(text).to.include("sync-token")
    })
  })

  // ─── Event PUT (create / update) ─────────────────────────────────────────

  describe("PUT /caldav/calendars/:user/:filename", () => {
    const testDate = "20251201"
    const testFilename = `test-event-caldav-${Date.now()}.ics`

    it("Should return 403 when writing to another user's calendar", async () => {
      const { status } = await request(app)
        .put(`/caldav/calendars/other-user/${testFilename}`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "text/calendar")
        .send(SAMPLE_ICAL(testDate))

      expect(status).to.equal(403)
    })

    it("Should return 400 when iCal body has no DTSTART", async () => {
      const badIcal =
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
      const filename = `test-no-date-${Date.now()}.ics`

      const { status } = await request(app)
        .put(`/caldav/calendars/${encodedUser}/${filename}`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "text/calendar")
        .send(badIcal)

      expect(status).to.equal(400)
    })

    it("Should create a new event and return 201 with Location and ETag headers", async () => {
      const { status, headers } = await request(app)
        .put(`/caldav/calendars/${encodedUser}/${testFilename}`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "text/calendar")
        .send(SAMPLE_ICAL(testDate))

      // The filename is random (not a valid MongoDB ObjectId), so the entry
      // won't be found by findEntry → a new entry will be created
      expect(status).to.equal(201)
      expect(headers["location"]).to.be.a("string")
      expect(headers["etag"]).to.be.a("string")

      // Extract the real filename from the Location header for downstream tests
      const locationParts = headers["location"].split("/")
      createdFilename = locationParts[locationParts.length - 1]
    })
  })

  // ─── Event GET ────────────────────────────────────────────────────────────

  describe("GET /caldav/calendars/:user/:filename", () => {
    it("Should return 200 with iCal content and ETag for an existing event", async () => {
      if (!createdFilename) return // guard: PUT test must have run first

      const { status, text, headers } = await request(app)
        .get(`/caldav/calendars/${encodedUser}/${createdFilename}`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(200)
      expect(headers["content-type"]).to.include("text/calendar")
      expect(headers["etag"]).to.be.a("string")
      expect(text).to.include("BEGIN:VCALENDAR")
      expect(text).to.include("VEVENT")
    })

    it("Should return 404 for a non-existent event", async () => {
      const { status } = await request(app)
        .get(`/caldav/calendars/${encodedUser}/000000000000000000000000.ics`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(404)
    })

    it("Should return 404 for a filename that is not a valid ObjectId", async () => {
      const { status } = await request(app)
        .get(`/caldav/calendars/${encodedUser}/not-a-mongo-id.ics`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(404)
    })
  })

  // ─── Event PROPFIND ──────────────────────────────────────────────────────

  describe("PROPFIND /caldav/calendars/:user/:filename", () => {
    it("Should return 207 with getetag for an existing event", async () => {
      if (!createdFilename) return

      const { status, text } = await request(app)
        .propfind(`/caldav/calendars/${encodedUser}/${createdFilename}`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(207)
      expect(text).to.include("getetag")
      expect(text).to.include("getcontenttype")
    })

    it("Should return 404 for a non-existent event", async () => {
      const { status } = await request(app)
        .propfind(
          `/caldav/calendars/${encodedUser}/000000000000000000000000.ics`
        )
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(PROPFIND_ALLPROP)

      expect(status).to.equal(404)
    })
  })

  // ─── Event update (PUT on existing) ──────────────────────────────────────

  describe("PUT /caldav/calendars/:user/:filename (update existing)", () => {
    it("Should return 204 when updating an existing event", async () => {
      if (!createdFilename) return

      const { status, headers } = await request(app)
        .put(`/caldav/calendars/${encodedUser}/${createdFilename}`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "text/calendar")
        .send(SAMPLE_ICAL("20251202", "積立有休"))

      expect(status).to.equal(204)
      expect(headers["etag"]).to.be.a("string")
    })
  })

  // ─── REPORT calendar-multiget ─────────────────────────────────────────────

  describe("REPORT calendar-multiget /caldav/calendars/:user/", () => {
    it("Should return 207 with calendar-data for a requested event href", async () => {
      if (!createdFilename) return

      const collHref = `/caldav/calendars/${encodedUser}/`

      const { status, text } = await request(app)
        .report(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(REPORT_CALENDAR_MULTIGET(collHref, createdFilename))

      expect(status).to.equal(207)
      expect(text).to.include("calendar-data")
    })

    it("Should return 207 with empty multistatus for an href that does not match", async () => {
      const collHref = `/caldav/calendars/${encodedUser}/`

      const { status, text } = await request(app)
        .report(`/caldav/calendars/${encodedUser}/`)
        .set("Authorization", basicAuth)
        .set("Content-Type", "application/xml")
        .send(
          REPORT_CALENDAR_MULTIGET(collHref, "000000000000000000000000.ics")
        )

      expect(status).to.equal(207)
      expect(text).to.include("multistatus")
    })
  })

  // ─── Event DELETE ─────────────────────────────────────────────────────────

  describe("DELETE /caldav/calendars/:user/:filename", () => {
    it("Should return 404 when deleting a non-existent event", async () => {
      const { status } = await request(app)
        .delete(`/caldav/calendars/${encodedUser}/000000000000000000000000.ics`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(404)
    })

    it("Should delete an existing event and return 204", async () => {
      if (!createdFilename) return

      const { status } = await request(app)
        .delete(`/caldav/calendars/${encodedUser}/${createdFilename}`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(204)
    })

    it("Should return 404 after the event has been deleted", async () => {
      if (!createdFilename) return

      const { status } = await request(app)
        .get(`/caldav/calendars/${encodedUser}/${createdFilename}`)
        .set("Authorization", basicAuth)

      expect(status).to.equal(404)
    })
  })
})
