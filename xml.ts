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
        `  <D:propstat>\n    <D:prop>\n${indentBlock(ps.props, 6)}\n    </D:prop>\n` +
        `    <D:status>HTTP/1.1 ${ps.status}</D:status>\n  </D:propstat>`
    )
    .join("\n")
  return `<D:response>\n  <D:href>${escapeXml(href)}</D:href>\n${inner}\n</D:response>\n`
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
  const matches = body.match(/<(?:[^:>\s]+:)?href[^>]*>(.*?)<\/(?:[^:>\s]+:)?href>/gi) ?? []
  return matches.map((m) => m.replace(/<[^>]+>/g, "").trim())
}

/** Extract the <sync-token> value from a sync-collection REPORT body. */
export function extractSyncToken(body: string): string | null {
  const match = body.match(
    /<(?:[^:>\s]+:)?sync-token[^>]*>(.*?)<\/(?:[^:>\s]+:)?sync-token>/i
  )
  return match ? match[1].trim() : null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces)
  return text
    .split("\n")
    .map((l) => `${pad}${l}`)
    .join("\n")
}
