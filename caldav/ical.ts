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
    `SUMMARY:${buildSummary(entry)}`,
    `DTSTAMP:${now}`,
  ]

  if (entry.comment) {
    lines.push(`DESCRIPTION:${entry.comment.replace(/\n/g, "\\n")}`)
  }

  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
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
  return crypto.createHash("md5").update(`${combined}:${entries.length}`).digest("hex")
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    Date.UTC(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)))
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
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}
