import * as XLSX from "xlsx";
import { db, newAttendee, type Attendee } from "./db";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ColumnMapping {
  fullName: string;
  email: string;
  ticketId: string;
}

export const NONE = "__none__";

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[k.trim()] = String(v ?? "").trim();
    return out;
  });
  return { headers, rows };
}

const patterns: Record<keyof ColumnMapping, RegExp[]> = {
  fullName: [/^full\s*name$/i, /^name$/i, /student\s*name/i, /attendee/i, /name/i],
  email: [/^e-?mail$/i, /e-?mail/i],
  ticketId: [/student\s*id/i, /ticket/i, /^id$/i, /number|no\.?$/i, /\bid\b/i],
};

export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const pick = (key: keyof ColumnMapping) => {
    for (const re of patterns[key]) {
      const h = headers.find((x) => !used.has(x) && re.test(x));
      if (h) {
        used.add(h);
        return h;
      }
    }
    return NONE;
  };
  // Email first so "Email" isn't mistaken for anything else; then ID, then name.
  const email = pick("email");
  const ticketId = pick("ticketId");
  const fullName = pick("fullName");
  return { fullName, email, ticketId };
}

export interface ImportSummary {
  added: number;
  skippedNoName: number;
  skippedDuplicate: number;
}

export async function importAttendees(
  eventId: string,
  sheet: ParsedSheet,
  mapping: ColumnMapping,
): Promise<ImportSummary> {
  const get = (row: Record<string, string>, col: string) => (col === NONE ? "" : (row[col] ?? "").trim());
  const existing = await db.attendees.where("eventId").equals(eventId).toArray();
  const ids = new Set(existing.map((a) => a.ticketId.toLowerCase()).filter(Boolean));
  const emails = new Set(existing.map((a) => a.email.toLowerCase()).filter(Boolean));

  const toAdd: Attendee[] = [];
  const summary: ImportSummary = { added: 0, skippedNoName: 0, skippedDuplicate: 0 };

  for (const row of sheet.rows) {
    const fullName = get(row, mapping.fullName);
    if (!fullName) {
      summary.skippedNoName++;
      continue;
    }
    const email = get(row, mapping.email);
    const ticketId = get(row, mapping.ticketId);
    if ((ticketId && ids.has(ticketId.toLowerCase())) || (email && emails.has(email.toLowerCase()))) {
      summary.skippedDuplicate++;
      continue;
    }
    const a = newAttendee(eventId, { fullName, email, ticketId });
    ids.add(a.ticketId.toLowerCase());
    if (email) emails.add(email.toLowerCase());
    toAdd.push(a);
  }

  await db.attendees.bulkAdd(toAdd);
  summary.added = toAdd.length;
  return summary;
}

export async function addWalkIn(
  eventId: string,
  data: { fullName: string; email?: string; ticketId?: string },
  checkIn: boolean,
): Promise<Attendee> {
  const a = newAttendee(eventId, { ...data, walkIn: true });
  if (checkIn) {
    a.checkedIn = 1;
    a.checkedInAt = Date.now();
  }
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.add(a);
    if (checkIn) {
      await db.outbox.add({
        type: "checkin",
        eventId,
        attendeeId: a.id,
        ticketId: a.ticketId,
        fullName: a.fullName,
        at: a.checkedInAt!,
      });
    }
  });
  return a;
}
