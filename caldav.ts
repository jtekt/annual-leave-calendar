import crypto from "crypto"

/**
 * Convert a MongoDB Entry document to a VCALENDAR iCal string.
 * All events are full-day (DATE value type, no time component).
 */
export function entryToIcal(entry: any): string {
  const dtstart = formatDate(new Date(entry.date))
  const dtend = formatDate(addDays(new Date(entry.date), 1))
  const uid = entryUid(entry)
  const now = formatDateTime(new Date())

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nenkyuu-calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapeIcalText(buildSummary(entry))}`,
    `DTSTAMP:${now}`,
  ]

  if (entry.comment) {
    lines.push(`DESCRIPTION:${escapeIcalText(entry.comment)}`)
  }

  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.map(foldIcalLine).join("\r\n") + "\r\n"
}

/**
 * Parse an iCal string from a CalDAV PUT request body.
 * Only extracts the fields relevant to Entry.
 */
export function parseIcal(icalText: string): {
  date?: Date
  type?: string
  comment?: string
} {
  // Unfold continuation lines (RFC 5545 §3.1)
  const unfolded = icalText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "")
  const lines = unfolded.split(/\r\n|\n/)
  const result: { date?: Date; type?: string; comment?: string } = {}

  for (const line of lines) {
    if (/^DTSTART/i.test(line)) {
      result.date = parseIcalDate(line)
    } else if (line.startsWith("SUMMARY:")) {
      result.type = line.slice(8).trim()
    } else if (line.startsWith("DESCRIPTION:")) {
      result.comment = line.slice(12).replace(/\\n/g, "\n").trim()
    }
  }

  return result
}

/**
 * Stable UID for an entry — the MongoDB _id string.
 */
export function entryUid(entry: any): string {
  return entry._id.toString()
}

/**
 * Filename used in CalDAV URLs.
 */
export function entryFilename(entry: any): string {
  return `${entryUid(entry)}.ics`
}

/**
 * ETag based on a hash of the entry's content fields.
 * Changes whenever the data changes, without needing an updatedAt timestamp.
 */
export function computeEtag(entry: any): string {
  const content = JSON.stringify({
    date: entry.date,
    type: entry.type,
    comment: entry.comment ?? null,
    reserve: entry.reserve,
    refresh: entry.refresh,
  })
  const hash = crypto.createHash("md5").update(content).digest("hex")
  return `"${hash}"`
}

/**
 * CTag (collection tag) — changes whenever any entry in the collection changes.
 * Used by clients to detect whether a full sync is needed.
 */
export function computeCtag(entries: any[]): string {
  const combined = entries
    .map((e) => computeEtag(e))
    .sort()
    .join("")
  return crypto
    .createHash("md5")
    .update(`${combined}:${entries.length}`)
    .digest("hex")
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, newlines. */
function escapeIcalText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/[\r\n]/g, "\\n")
}

/** RFC 5545 §3.1: fold lines longer than 75 octets with CRLF + SPACE. */
function foldIcalLine(line: string): string {
  const bytes = Buffer.from(line, "utf8")
  if (bytes.byteLength <= 75) return line

  const parts: string[] = []
  let offset = 0
  let limit = 75
  while (offset < bytes.byteLength) {
    let end = Math.min(offset + limit, bytes.byteLength)
    // don't split a multi-byte UTF-8 sequence
    while (end < bytes.byteLength && (bytes[end] & 0xc0) === 0x80) end--
    parts.push(Buffer.from(bytes.subarray(offset, end)).toString("utf8"))
    offset = end
    limit = 74 // continuation lines lose one octet to the leading space
  }
  return parts.join("\r\n ")
}

function buildSummary(entry: any): string {
  if (entry.refresh) return "更新休暇"
  if (entry.reserve) return "積立有休"
  return entry.type ?? "有休"
}

function parseIcalDate(line: string): Date {
  // Matches DTSTART;VALUE=DATE:20240115 or DTSTART:20240115
  const match = line.match(/:(\d{8})/)
  if (!match) throw new Error(`Cannot parse iCal date from: ${line}`)
  const s = match[1]
  return new Date(
    Date.UTC(
      parseInt(s.slice(0, 4)),
      parseInt(s.slice(4, 6)) - 1,
      parseInt(s.slice(6, 8))
    )
  )
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

function formatDateTime(date: Date): string {
  // iCal UTC datetime: 20240115T083000Z
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

/**
 * WebDAV / CalDAV XML response builders.
 *
 * Namespace prefixes used throughout:
 *   (default) DAV:
 *   C  urn:ietf:params:xml:ns:caldav
 *   CS http://calendarserver.org/ns/   (CTag)
 */

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;") // preserve CR so iCal CRLF survives XML line-ending normalization
}

interface Propstat {
  props: string
  status: string
}

export function multistatusXml(responses: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">\n` +
    responses.join("") +
    `</D:multistatus>`
  )
}

export function responseXml(href: string, propstats: Propstat[]): string {
  const inner = propstats
    .map(
      (ps) =>
        `<D:propstat><D:prop>${ps.props}</D:prop>` +
        `<D:status>HTTP/1.1 ${ps.status}</D:status></D:propstat>`
    )
    .join("")
  return `<D:response><D:href>${escapeXml(href)}</D:href>${inner}</D:response>`
}

// ─── PROPFIND request parser ─────────────────────────────────────────────────

const NS_TO_PREFIX: Record<string, string> = {
  "DAV:": "D",
  "urn:ietf:params:xml:ns:caldav": "C",
  "http://calendarserver.org/ns/": "CS",
}

/**
 * Parse a PROPFIND body and return the set of requested properties as
 * "{namespace}localname" strings, or "allprop"/"propname" for those request types.
 */
export function parsePropfindRequest(
  body: string
): Set<string> | "allprop" | "propname" {
  if (!body || /<(?:[^:>\s]+:)?allprop[\s/>]/i.test(body)) return "allprop"
  if (/<(?:[^:>\s]+:)?propname[\s/>]/i.test(body)) return "propname"

  const nsPrefixes: Record<string, string> = {}
  for (const m of body.matchAll(/xmlns:([^=\s"']+)\s*=\s*["']([^"']+)["']/g)) {
    nsPrefixes[m[1]] = m[2]
  }
  const defaultNsMatch = body.match(/\bxmlns\s*=\s*["']([^"']+)["']/)
  const defaultNs = defaultNsMatch ? defaultNsMatch[1] : "DAV:"

  const propMatch = body.match(
    /<(?:[^:>\s]+:)?prop[^>]*>([\s\S]*?)<\/(?:[^:>\s]+:)?prop>/i
  )
  if (!propMatch) return "allprop"

  const requested = new Set<string>()
  for (const m of propMatch[1].matchAll(/<(?:([^:>\s]+):)?([^>\s/]+)/g)) {
    const prefix = m[1] ?? ""
    const localName = m[2]
    const ns = prefix ? (nsPrefixes[prefix] ?? `${prefix}:`) : defaultNs
    requested.add(`{${ns}}${localName}`)
  }
  return requested
}

/**
 * Convert a "{namespace}localname" key back to an empty XML element,
 * using our standard namespace prefixes.
 */
export function keyToEmptyElement(key: string): string {
  const m = key.match(/^\{([^}]*)\}(.+)$/)
  if (!m) return `<D:${key}/>`
  const [, ns, localName] = m
  const prefix = NS_TO_PREFIX[ns]
  if (prefix) return `<${prefix}:${localName}/>`
  return `<x:${localName} xmlns:x="${escapeXml(ns)}"/>`
}

/**
 * Given a set of requested property keys and a map of key→xml-string,
 * return propstat objects for 200 (found) and 404 (not found).
 */
export function buildPropstats(
  requested: Set<string> | "allprop" | "propname",
  propMap: Record<string, string>
): Array<{ props: string; status: string }> {
  if (requested === "allprop" || requested === "propname") {
    const props = Object.values(propMap).join("\n")
    return props ? [{ props, status: "200 OK" }] : []
  }

  const found: string[] = []
  const notFound: string[] = []
  for (const key of requested) {
    if (key in propMap) {
      found.push(propMap[key])
    } else {
      notFound.push(keyToEmptyElement(key))
    }
  }

  const result: Array<{ props: string; status: string }> = []
  if (found.length) result.push({ props: found.join("\n"), status: "200 OK" })
  if (notFound.length)
    result.push({ props: notFound.join("\n"), status: "404 Not Found" })
  return result
}

// ─── Request body parsers ────────────────────────────────────────────────────

export function detectReportType(
  body: string
): "calendar-multiget" | "calendar-query" | "sync-collection" | "unknown" {
  if (/calendar-multiget/i.test(body)) return "calendar-multiget"
  if (/sync-collection/i.test(body)) return "sync-collection"
  if (/calendar-query/i.test(body)) return "calendar-query"
  return "unknown"
}

/** Extract <href> values from a calendar-multiget REPORT body. */
export function extractHrefs(body: string): string[] {
  const matches =
    body.match(/<(?:[^:>\s]+:)?href[^>]*>(.*?)<\/(?:[^:>\s]+:)?href>/gi) ?? []
  return matches.map((m) => m.replace(/<[^>]+>/g, "").trim())
}

/**
 * Extract <C:time-range start="..." end="..."/> from a calendar-query REPORT body.
 * Attributes are in iCal datetime format: 20240101T000000Z
 */
export function extractTimeRange(
  body: string
): { start: Date; end: Date } | null {
  const m = body.match(/<[^:>\s]+:time-range[^>]+>/i)
  if (!m) return null
  const startMatch = m[0].match(/start="(\d{8}T\d{6}Z)"/)
  const endMatch = m[0].match(/end="(\d{8}T\d{6}Z)"/)
  if (!startMatch || !endMatch) return null
  return { start: parseIcalDateTime(startMatch[1]), end: parseIcalDateTime(endMatch[1]) }
}

function parseIcalDateTime(s: string): Date {
  return new Date(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
  )
}

/** Extract the <sync-token> value from a sync-collection REPORT body. */
export function extractSyncToken(body: string): string | null {
  const match = body.match(
    /<(?:[^:>\s]+:)?sync-token[^>]*>(.*?)<\/(?:[^:>\s]+:)?sync-token>/i
  )
  return match ? match[1].trim() : null
}

