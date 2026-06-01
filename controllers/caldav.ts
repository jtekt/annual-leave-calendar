import { Request, Response } from "express"
import createHttpError from "http-errors"
import {
  entryToIcal,
  entryFilename,
  parseIcal,
  computeEtag,
  computeCtag,
  escapeXml,
  multistatusXml,
  responseXml,
  detectReportType,
  extractHrefs,
  extractSyncToken,
  extractTimeRange,
  parsePropfindRequest,
  buildPropstats,
} from "../caldav"

import Entry from "../models/entry"
import { getUserId } from "../utils"

// ─── Root (/caldav/) ──────────────────────────────────────────────────────────

export const handleRoot = (req: Request, res: Response) => {
  const identifier = getUserId(res.locals.user)
  const principalHref = `/caldav/principals/${encodeURIComponent(identifier)}/`

  const propMap: Record<string, string> = {
    "{DAV:}current-user-principal": `<D:current-user-principal><D:href>${escapeXml(principalHref)}</D:href></D:current-user-principal>`,
    "{DAV:}principal-collection-set": `<D:principal-collection-set><D:href>/caldav/principals/</D:href></D:principal-collection-set>`,
  }

  const requested = parsePropfindRequest(req.body as string)
  const propstats = buildPropstats(requested, propMap)

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml([responseXml("/caldav/", propstats)]))
}

// ─── Principals (/caldav/principals/:user/) ───────────────────────────────────

export const handlePrincipalPropfind = (req: Request, res: Response) => {
  const identifier = getUserId(res.locals.user)
  const encodedUser = encodeURIComponent(identifier)
  const principalHref = `/caldav/principals/${encodedUser}/`
  const calHomeHref = `/caldav/calendars/${encodedUser}/`

  const propMap: Record<string, string> = {
    "{DAV:}displayname": `<D:displayname>${escapeXml(identifier)}</D:displayname>`,
    "{urn:ietf:params:xml:ns:caldav}calendar-home-set": `<C:calendar-home-set><D:href>${escapeXml(calHomeHref)}</D:href></C:calendar-home-set>`,
    "{DAV:}principal-URL": `<D:principal-URL><D:href>${escapeXml(principalHref)}</D:href></D:principal-URL>`,
    "{DAV:}current-user-principal": `<D:current-user-principal><D:href>${escapeXml(principalHref)}</D:href></D:current-user-principal>`,
    "{urn:ietf:params:xml:ns:caldav}calendar-user-address-set": `<C:calendar-user-address-set><D:href>${escapeXml(principalHref)}</D:href></C:calendar-user-address-set>`,
  }

  const requested = parsePropfindRequest(req.body as string)
  const propstats = buildPropstats(requested, propMap)

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml([responseXml(principalHref, propstats)]))
}

// ─── Calendar collection (/caldav/calendars/:user/) ───────────────────────────

export const handleCalendarPropfind = async (req: Request, res: Response) => {
  const identifier = getUserId(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier)
    throw createHttpError(403, "Forbidden")

  const depth = (req.headers["depth"] as string) ?? "0"
  const entries = await Entry.find({ user_id: identifier }).lean()
  const ctag = computeCtag(entries)
  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
  const principalHref = `/caldav/principals/${encodeURIComponent(identifier)}/`

  const calPropMap: Record<string, string> = {
    "{DAV:}resourcetype": `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype>`,
    "{DAV:}displayname": `<D:displayname>${escapeXml(identifier)} \u2013 Leave Calendar</D:displayname>`,
    "{http://calendarserver.org/ns/}getctag": `<CS:getctag>${escapeXml(ctag)}</CS:getctag>`,
    "{DAV:}sync-token": `<D:sync-token>${escapeXml(ctag)}</D:sync-token>`,
    "{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set": `<C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>`,
    "{urn:ietf:params:xml:ns:caldav}calendar-description": `<C:calendar-description>Leave calendar for ${escapeXml(identifier)}</C:calendar-description>`,
    "{DAV:}supported-report-set": [
      `<D:supported-report-set>`,
      `  <D:supported-report><D:report><C:calendar-multiget/></D:report></D:supported-report>`,
      `  <D:supported-report><D:report><C:calendar-query/></D:report></D:supported-report>`,
      `  <D:supported-report><D:report><D:sync-collection/></D:report></D:supported-report>`,
      `</D:supported-report-set>`,
    ].join("\n"),
    "{DAV:}current-user-privilege-set": [
      `<D:current-user-privilege-set>`,
      `  <D:privilege><D:read/></D:privilege>`,
      `  <D:privilege><D:write/></D:privilege>`,
      `  <D:privilege><D:write-content/></D:privilege>`,
      `  <D:privilege><D:write-properties/></D:privilege>`,
      `  <D:privilege><D:bind/></D:privilege>`,
      `  <D:privilege><D:unbind/></D:privilege>`,
      `</D:current-user-privilege-set>`,
    ].join("\n"),
    "{DAV:}current-user-principal": `<D:current-user-principal><D:href>${escapeXml(principalHref)}</D:href></D:current-user-principal>`,
    "{DAV:}principal-URL": `<D:principal-URL><D:href>${escapeXml(principalHref)}</D:href></D:principal-URL>`,
  }

  const requested = parsePropfindRequest(req.body as string)
  const responses: string[] = [
    responseXml(collHref, buildPropstats(requested, calPropMap)),
  ]

  if (depth === "1") {
    const eventPropMap: Record<string, string> = {
      "{DAV:}resourcetype": `<D:resourcetype/>`,
      "{DAV:}getetag": ``,
      "{DAV:}getcontenttype": `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
    }
    for (const entry of entries) {
      const eventHref = `${collHref}${encodeURIComponent(entryFilename(entry))}`
      const entryPropMap = {
        ...eventPropMap,
        "{DAV:}getetag": `<D:getetag>${escapeXml(computeEtag(entry))}</D:getetag>`,
      }
      responses.push(
        responseXml(eventHref, buildPropstats(requested, entryPropMap))
      )
    }
  }

  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(multistatusXml(responses))
}

export const handleReport = async (req: Request, res: Response) => {
  const identifier = getUserId(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier)
    throw createHttpError(403, "Forbidden")

  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
  const body = (req.body as string) ?? ""
  const timeRange = extractTimeRange(body)
  const dateFilter = timeRange
    ? { date: { $gte: timeRange.start, $lte: timeRange.end } }
    : {}
  const entries = await Entry.find({
    ...{ user_id: identifier },
    ...dateFilter,
  }).lean()

  if (detectReportType(body) === "calendar-multiget") {
    const requestedFilenames = new Set(
      extractHrefs(body).map((h) =>
        decodeURIComponent(h.split("/").pop() ?? "")
      )
    )
    const matched = entries.filter((e: any) =>
      requestedFilenames.has(entryFilename(e))
    )

    return res
      .status(207)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(
        multistatusXml(
          matched.map((entry: any) =>
            responseXml(
              `${collHref}${encodeURIComponent(entryFilename(entry))}`,
              [
                {
                  props: [
                    `<D:getetag>${escapeXml(computeEtag(entry))}</D:getetag>`,
                    `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
                  ].join("\n"),
                  status: "200 OK",
                },
              ]
            )
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
      `<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">\n` +
      toReturn
        .map((entry: any) =>
          responseXml(
            `${collHref}${encodeURIComponent(entryFilename(entry))}`,
            [
              {
                props: [
                  `<D:getetag>${escapeXml(computeEtag(entry))}</D:getetag>`,
                  `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
                ].join("\n"),
                status: "200 OK",
              },
            ]
          )
        )
        .join("") +
      `<D:sync-token>${escapeXml(currentCtag)}</D:sync-token>\n` +
      `</D:multistatus>`

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
        entries.map((entry: any) =>
          responseXml(
            `${collHref}${encodeURIComponent(entryFilename(entry))}`,
            [
              {
                props: [
                  `<D:getetag>${escapeXml(computeEtag(entry))}</D:getetag>`,
                  `<C:calendar-data>${escapeXml(entryToIcal(entry))}</C:calendar-data>`,
                ].join("\n"),
                status: "200 OK",
              },
            ]
          )
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
  const identifier = getUserId(res.locals.user)

  if (decodeURIComponent(req.params.user) !== identifier)
    throw createHttpError(403, "Forbidden")

  const parsed = parseIcal((req.body as string) ?? "")
  if (!parsed.date)
    throw createHttpError(400, "Missing or unparseable DTSTART in iCal data")

  const existing = await findEntry(req, res)

  if (existing) {
    existing.date = parsed.date
    if (parsed.type) existing.type = parsed.type
    existing.comment = parsed.comment ?? existing.comment
    await existing.save()

    return res.setHeader("ETag", computeEtag(existing)).status(204).end()
  }

  const newEntry = await Entry.create({
    user_id: identifier,
    date: parsed.date,
    type: parsed.type ?? "有休",
    comment: parsed.comment,
  })

  const location = `/caldav/calendars/${encodeURIComponent(identifier)}/${encodeURIComponent(entryFilename(newEntry))}`
  res
    .setHeader("Location", location)
    .setHeader("ETag", computeEtag(newEntry))
    .status(201)
    .end()
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

  const identifier = getUserId(res.locals.user)
  const collHref = `/caldav/calendars/${encodeURIComponent(identifier)}/`
  const eventHref = `${collHref}${encodeURIComponent(entryFilename(entry))}`

  const propMap: Record<string, string> = {
    "{DAV:}getetag": `<D:getetag>${escapeXml(computeEtag(entry))}</D:getetag>`,
    "{DAV:}getcontenttype": `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
    "{DAV:}resourcetype": `<D:resourcetype/>`,
  }

  const requested = parsePropfindRequest(req.body as string)
  res
    .status(207)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .send(
      multistatusXml([
        responseXml(eventHref, buildPropstats(requested, propMap)),
      ])
    )
}

// ─── Shared helper ────────────────────────────────────────────────────────────

async function findEntry(req: Request, res: Response) {
  const uid = decodeURIComponent(req.params.filename).replace(/\.ics$/i, "")
  const userId = getUserId(res.locals.user)
  if (!/^[a-f0-9]{24}$/i.test(uid)) return null
  return Entry.findOne({
    user_id: userId,
    _id: uid,
  })
}
