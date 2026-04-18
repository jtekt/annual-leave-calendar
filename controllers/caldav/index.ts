import { Request, Response } from "express"
import createHttpError from "http-errors"
import { entryToIcal, entryFilename, parseIcal, computeEtag, computeCtag } from "../../ical"
import {
  escapeXml,
  multistatusXml,
  responseXml,
  detectReportType,
  extractHrefs,
  extractSyncToken,
} from "../../xml"
import Entry from "../../models/entry"
import { getOtherUserIdentifier, resolveUserQuery, resolveUserEntryFields } from "../../utils"

// ─── Root (/caldav/) ──────────────────────────────────────────────────────────

export const handleRoot = (req: Request, res: Response) => {
  const identifier = getOtherUserIdentifier(res.locals.user)
  const principalHref = `/caldav/principals/${encodeURIComponent(identifier)}/`

  const props = [
    `<current-user-principal><href>${escapeXml(principalHref)}</href></current-user-principal>`,
    `<principal-collection-set><href>/caldav/principals/</href></principal-collection-set>`,
  ].join("\n")

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml([responseXml("/caldav/", [{ props, status: "200 OK" }])]))
}

// ─── Principals (/caldav/principals/:user/) ───────────────────────────────────

export const handlePrincipalPropfind = (req: Request, res: Response) => {
  const identifier = getOtherUserIdentifier(res.locals.user)
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
}

// ─── Calendar collection (/caldav/calendars/:user/) ───────────────────────────

export const handleCalendarPropfind = async (req: Request, res: Response) => {
  const identifier = getOtherUserIdentifier(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier) throw createHttpError(403, "Forbidden")

  const depth = (req.headers["depth"] as string) ?? "0"
  const entries = await Entry.find(resolveUserQuery({ user: res.locals.user })).lean()
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

  if (depth === "1") {
    for (const entry of entries) {
      const eventHref = `${collHref}${encodeURIComponent(entryFilename(entry))}`
      responses.push(
        responseXml(eventHref, [
          {
            props: [
              `<resourcetype/>`,
              `<getetag>${escapeXml(computeEtag(entry))}</getetag>`,
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

export const handleReport = async (req: Request, res: Response) => {
  const identifier = getOtherUserIdentifier(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier) throw createHttpError(403, "Forbidden")

  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
  const body = (req.body as string) ?? ""
  const entries = await Entry.find(resolveUserQuery({ user: res.locals.user })).lean()

  if (detectReportType(body) === "calendar-multiget") {
    const requestedFilenames = new Set(
      extractHrefs(body).map((h) => decodeURIComponent(h.split("/").pop() ?? ""))
    )
    const matched = entries.filter((e) => requestedFilenames.has(entryFilename(e)))

    return res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(
        multistatusXml(
          matched.map((entry) =>
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
        )
      )
  }

  if (detectReportType(body) === "sync-collection") {
    const clientSyncToken = extractSyncToken(body)
    const currentCtag = computeCtag(entries)
    const toReturn = clientSyncToken === currentCtag ? [] : entries

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">\n` +
      toReturn
        .map((entry) =>
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
        .join("") +
      `<sync-token>${escapeXml(currentCtag)}</sync-token>\n` +
      `</multistatus>`

    return res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(xml)
  }

  // calendar-query and unknown: return all events
  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(
      multistatusXml(
        entries.map((entry) =>
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
      )
    )
}

// ─── Individual events (/caldav/calendars/:user/:filename) ───────────────────

export const handleEventGet = async (req: Request, res: Response) => {
  const entry = await findEntry(req, res)
  if (!entry) return res.status(404).send("Event not found")

  res
    .setHeader("Content-Type", "text/calendar; charset=utf-8")
    .setHeader("ETag", computeEtag(entry))
    .send(entryToIcal(entry))
}

export const handleEventPut = async (req: Request, res: Response) => {
  const identifier = getOtherUserIdentifier(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier) throw createHttpError(403, "Forbidden")

  const parsed = parseIcal((req.body as string) ?? "")
  if (!parsed.date) throw createHttpError(400, "Missing or unparseable DTSTART in iCal data")

  const existing = await findEntry(req, res)

  if (existing) {
    existing.date = parsed.date
    if (parsed.type) existing.type = parsed.type
    existing.comment = parsed.comment ?? existing.comment
    await existing.save()

    return res.setHeader("ETag", computeEtag(existing)).status(204).end()
  }

  const newEntry = await Entry.create({
    ...resolveUserEntryFields(res.locals.user),
    date: parsed.date,
    type: parsed.type ?? "有休",
    comment: parsed.comment,
  })

  const location = `/caldav/calendars/${encodeURIComponent(identifier)}/${encodeURIComponent(entryFilename(newEntry))}`
  res.setHeader("Location", location).setHeader("ETag", computeEtag(newEntry)).status(201).end()
}

export const handleEventDelete = async (req: Request, res: Response) => {
  const entry = await findEntry(req, res)
  if (!entry) return res.status(404).send("Event not found")

  await entry.deleteOne()
  res.status(204).end()
}

export const handleEventPropfind = async (req: Request, res: Response) => {
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

// ─── Shared helper ────────────────────────────────────────────────────────────

async function findEntry(req: Request, res: Response) {
  const uid = decodeURIComponent(req.params.filename).replace(/\.ics$/i, "")
  if (!/^[a-f0-9]{24}$/i.test(uid)) return null
  return Entry.findOne({ ...resolveUserQuery({ user: res.locals.user }), _id: uid })
}
