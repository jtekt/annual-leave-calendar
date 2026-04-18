import { Router, Request, Response, NextFunction } from "express"
import express from "express"
import createHttpError from "http-errors"
import { createCaldavAuth } from "./auth"
import {
  entryToIcal,
  entryFilename,
  parseIcal,
  computeEtag,
  computeCtag,
} from "./ical"
import {
  escapeXml,
  multistatusXml,
  responseXml,
  detectReportType,
  extractHrefs,
  extractSyncToken,
} from "./xml"
import Entry from "../models/entry"
import { getOtherUserIdentifier, resolveUserQuery, resolveUserEntryFields } from "../utils"

const router = Router()

// Parse XML and iCal request bodies as text
router.use(express.text({ type: ["application/xml", "text/xml", "text/calendar", "text/plain"] }))

// Bridge Basic Auth JWT → legacyMiddleware
router.use(createCaldavAuth())

// ─── OPTIONS ─────────────────────────────────────────────────────────────────
// Advertise DAV capabilities for all paths under /caldav

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "OPTIONS") return next()
  res.setHeader("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT")
  res.setHeader("DAV", "1, 2, 3, calendar-access")
  res.setHeader("MS-Author-Via", "DAV")
  res.status(204).end()
})

// ─── Root PROPFIND (/caldav/) ─────────────────────────────────────────────────
// Returns the current-user-principal so clients can bootstrap discovery.

router.all("/", (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "PROPFIND") return next()

  const user = res.locals.user
  const identifier = getOtherUserIdentifier(user)
  const principalHref = `/caldav/principals/${encodeURIComponent(identifier)}/`

  const props = [
    `<current-user-principal><href>${escapeXml(principalHref)}</href></current-user-principal>`,
    `<principal-collection-set><href>/caldav/principals/</href></principal-collection-set>`,
  ].join("\n")

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml([responseXml("/caldav/", [{ props, status: "200 OK" }])]))
})

// ─── Principals (/caldav/principals/:user/) ───────────────────────────────────

router.all("/principals/:user/", (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "PROPFIND") return next()

  const user = res.locals.user
  const identifier = getOtherUserIdentifier(user)
  const encodedUser = encodeURIComponent(identifier)
  const principalHref = `/caldav/principals/${encodedUser}/`
  const calHomeHref = `/caldav/calendars/${encodedUser}/`

  const props = [
    `<displayname>${escapeXml(identifier)}</displayname>`,
    `<C:calendar-home-set><href>${escapeXml(calHomeHref)}</href></C:calendar-home-set>`,
    `<principal-URL><href>${escapeXml(principalHref)}</href></principal-URL>`,
    `<current-user-principal><href>${escapeXml(principalHref)}</href></current-user-principal>`,
  ].join("\n")

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml([responseXml(principalHref, [{ props, status: "200 OK" }])]))
})

// ─── Calendar collection (/caldav/calendars/:user/) ───────────────────────────

router.all("/calendars/:user/", async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "PROPFIND") return handleCalendarPropfind(req, res)
  if (req.method === "REPORT") return handleReport(req, res)
  next()
})

async function handleCalendarPropfind(req: Request, res: Response) {
  const { user: userParam } = req.params
  const identifier = getOtherUserIdentifier(res.locals.user)

  if (decodeURIComponent(userParam) !== identifier) {
    throw createHttpError(403, "Forbidden")
  }

  const depth = (req.headers["depth"] as string) ?? "0"
  const query = resolveUserQuery({ user: res.locals.user })
  const entries = await Entry.find(query).lean()
  const ctag = computeCtag(entries)
  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`

  const calProps = [
    `<resourcetype><collection/><C:calendar/></resourcetype>`,
    `<displayname>${escapeXml(identifier)} – Leave Calendar</displayname>`,
    `<CS:getctag>${escapeXml(ctag)}</CS:getctag>`,
    `<sync-token>${escapeXml(ctag)}</sync-token>`,
    `<C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>`,
    `<C:calendar-description>Leave calendar for ${escapeXml(identifier)}</C:calendar-description>`,
  ].join("\n")

  const responses: string[] = [responseXml(collHref, [{ props: calProps, status: "200 OK" }])]

  // Depth: 1 — include event stubs so clients can decide what to fetch
  if (depth === "1") {
    for (const entry of entries) {
      const eventHref = `${collHref}${encodeURIComponent(entryFilename(entry))}`
      const etag = computeEtag(entry)
      responses.push(
        responseXml(eventHref, [
          {
            props: [
              `<resourcetype/>`,
              `<getetag>${escapeXml(etag)}</getetag>`,
              `<getcontenttype>text/calendar; charset=utf-8</getcontenttype>`,
            ].join("\n"),
            status: "200 OK",
          },
        ])
      )
    }
  }

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml(responses))
}

async function handleReport(req: Request, res: Response) {
  const { user: userParam } = req.params
  const identifier = getOtherUserIdentifier(res.locals.user)

  if (decodeURIComponent(userParam) !== identifier) {
    throw createHttpError(403, "Forbidden")
  }

  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
  const body = (req.body as string) ?? ""
  const reportType = detectReportType(body)
  const query = resolveUserQuery({ user: res.locals.user })
  const entries = await Entry.find(query).lean()

  if (reportType === "calendar-multiget") {
    const hrefs = extractHrefs(body)
    const requestedFilenames = new Set(
      hrefs.map((h) => decodeURIComponent(h.split("/").pop() ?? ""))
    )
    const matched = entries.filter((e) => requestedFilenames.has(entryFilename(e)))

    const responses = matched.map((entry) =>
      responseXml(`${collHref}${encodeURIComponent(entryFilename(entry))}`, [
        {
          props: [
            `<getetag>${escapeXml(computeEtag(entry))}</getetag>`,
            `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
          ].join("\n"),
          status: "200 OK",
        },
      ])
    )

    return res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(multistatusXml(responses))
  }

  if (reportType === "sync-collection") {
    const clientSyncToken = extractSyncToken(body)
    const currentCtag = computeCtag(entries)

    // If the client is already up to date, return an empty multistatus
    const toReturn = clientSyncToken === currentCtag ? [] : entries

    const responses = toReturn.map((entry) =>
      responseXml(`${collHref}${encodeURIComponent(entryFilename(entry))}`, [
        {
          props: [
            `<getetag>${escapeXml(computeEtag(entry))}</getetag>`,
            `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
          ].join("\n"),
          status: "200 OK",
        },
      ])
    )

    // The sync-token appears as a sibling of <response> inside <multistatus>
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">\n` +
      responses.join("") +
      `<sync-token>${escapeXml(currentCtag)}</sync-token>\n` +
      `</multistatus>`

    return res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(xml)
  }

  // calendar-query (and unknown): return all events with full iCal data
  const responses = entries.map((entry) =>
    responseXml(`${collHref}${encodeURIComponent(entryFilename(entry))}`, [
      {
        props: [
          `<getetag>${escapeXml(computeEtag(entry))}</getetag>`,
          `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
        ].join("\n"),
        status: "200 OK",
      },
    ])
  )

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml(responses))
}

// ─── Individual events (/caldav/calendars/:user/:filename) ───────────────────

// GET — return the .ics file
router.get(
  "/calendars/:user/:filename",
  async (req: Request, res: Response) => {
    const entry = await findEntry(req, res)
    if (!entry) return res.status(404).send("Event not found")

    res
      .setHeader("Content-Type", "text/calendar; charset=utf-8")
      .setHeader("ETag", computeEtag(entry))
      .send(entryToIcal(entry))
  }
)

// PUT — create or update an event
router.put(
  "/calendars/:user/:filename",
  async (req: Request, res: Response) => {
    const identifier = getOtherUserIdentifier(res.locals.user)

    if (decodeURIComponent(req.params.user) !== identifier) {
      throw createHttpError(403, "Forbidden")
    }

    const body = (req.body as string) ?? ""
    const parsed = parseIcal(body)

    if (!parsed.date) {
      throw createHttpError(400, "Missing or unparseable DTSTART in iCal data")
    }

    const existing = await findEntry(req, res)

    if (existing) {
      // Update
      existing.date = parsed.date
      if (parsed.type) existing.type = parsed.type
      existing.comment = parsed.comment ?? existing.comment
      await existing.save()

      res.setHeader("ETag", computeEtag(existing)).status(204).end()
    } else {
      // Create — ignore the client's UID; MongoDB generates the _id.
      // Respond with Location so the client learns the canonical URL.
      const userFields = resolveUserEntryFields(res.locals.user)
      const newEntry = await Entry.create({
        ...userFields,
        date: parsed.date,
        type: parsed.type ?? "有休",
        comment: parsed.comment,
      })

      const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
      const location = `${collHref}${encodeURIComponent(entryFilename(newEntry))}`

      res
        .setHeader("Location", location)
        .setHeader("ETag", computeEtag(newEntry))
        .status(201)
        .end()
    }
  }
)

// DELETE — remove an event
router.delete(
  "/calendars/:user/:filename",
  async (req: Request, res: Response) => {
    const entry = await findEntry(req, res)
    if (!entry) return res.status(404).send("Event not found")

    await entry.deleteOne()
    res.status(204).end()
  }
)

// PROPFIND on an individual event — return ETag and content-type
router.all(
  "/calendars/:user/:filename",
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "PROPFIND") return next()

    const entry = await findEntry(req, res)
    if (!entry) return res.status(404).send("Event not found")

    const identifier = getOtherUserIdentifier(res.locals.user)
    const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
    const eventHref = `${collHref}${encodeURIComponent(entryFilename(entry))}`

    res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(
        multistatusXml([
          responseXml(eventHref, [
            {
              props: [
                `<getetag>${escapeXml(computeEtag(entry))}</getetag>`,
                `<getcontenttype>text/calendar; charset=utf-8</getcontenttype>`,
              ].join("\n"),
              status: "200 OK",
            },
          ]),
        ])
      )
  }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up an Entry by the UID extracted from the request URL filename.
 * The filename is expected to be `{mongodb_id}.ics`.
 */
async function findEntry(req: Request, res: Response) {
  const filename = decodeURIComponent(req.params.filename)
  const uid = filename.replace(/\.ics$/i, "")
  const userQuery = resolveUserQuery({ user: res.locals.user })

  // Only accept 24-char hex ObjectId strings to avoid Mongoose cast errors
  if (!/^[a-f0-9]{24}$/i.test(uid)) return null

  return Entry.findOne({ ...userQuery, _id: uid })
}

export default router
