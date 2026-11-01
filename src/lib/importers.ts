import * as XLSX from "xlsx";
import { db, newAttendee, type Attendee } from "./db";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
}

export interface ColumnMapping {
  name: string;
  email: string;
  externalId: string;
}

/** Sentinel for "no column chosen". */
export const NONE = "__none__";

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The file doesn't contain any sheets.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })[0] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
  if (headers.length === 0 || rows.length === 0) throw new Error("No rows found. Make sure the first row contains column names.");
  return { headers, rows, fileName: file.name };
}

const NAME_HINTS = [/^full ?name$/i, /^name$/i, /student ?name/i, /attendee/i, /name/i];
const EMAIL_HINTS = [/^e-?mail$/i, /e-?mail/i, /mail/i];
const ID_HINTS = [/student ?(id|no|number)/i, /ticket ?(id|no|number)/i, /^id$/i, /\bid\b/i, /number/i];

function pick(headers: string[], hints: RegExp[], exclude: string[] = []) {
  for (const hint of hints) {
    const match = headers.find((h) => hint.test(h) && !exclude.includes(h));
    if (match) return match;
  }
  return NONE;
}

export function guessMapping(headers: string[]): ColumnMapping {
  const email = pick(headers, EMAIL_HINTS);
  const externalId = pick(headers, ID_HINTS, [email]);
  const name = pick(headers, NAME_HINTS, [email, externalId]);
  return { name, email, externalId };
}

/** Builds a name from "First name" + "Last name" columns when there's no single name column. */
function fallbackName(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const first = keys.find((k) => /first/i.test(k));
  const last = keys.find((k) => /(last|sur)/i.test(k));
  return [first && row[first], last && row[last]].filter(Boolean).join(" ");
}

export interface ImportSummary {
  added: number;
  skippedDuplicates: number;
  skippedEmpty: number;
}

export async function importAttendees(eventId: string, sheet: ParsedSheet, mapping: ColumnMapping): Promise<ImportSummary> {
  const cell = (row: Record<string, unknown>, col: string) => (col === NONE ? "" : String(row[col] ?? "").trim());

  const existing = await db.attendees.where("eventId").equals(eventId).toArray();
  const seenIds = new Set(existing.map((a) => a.externalId.toLowerCase()).filter(Boolean));
  const seenEmails = new Set(existing.map((a) => a.email.toLowerCase()).filter(Boolean));

  const toAdd: Attendee[] = [];
  let skippedDuplicates = 0;
  let skippedEmpty = 0;

  for (const row of sheet.rows) {
    const name = cell(row, mapping.name) || (mapping.name === NONE ? fallbackName(row) : "");
    if (!name) {
      skippedEmpty++;
      continue;
    }
    const email = cell(row, mapping.email);
    const externalId = cell(row, mapping.externalId);
    const idKey = externalId.toLowerCase();
    const emailKey = email.toLowerCase();
    if ((idKey && seenIds.has(idKey)) || (emailKey && seenEmails.has(emailKey))) {
      skippedDuplicates++;
      continue;
    }
    const attendee = newAttendee(eventId, { name, email, externalId });
    seenIds.add(attendee.externalId.toLowerCase());
    if (emailKey) seenEmails.add(emailKey);
    toAdd.push(attendee);
  }

  await db.attendees.bulkAdd(toAdd);
  return { added: toAdd.length, skippedDuplicates, skippedEmpty };
}

export async function addWalkIn(eventId: string, data: { name: string; email?: string; externalId?: string }) {
  const attendee: Attendee = {
    ...newAttendee(eventId, { ...data, walkIn: true }),
    status: "checked_in",
    checkedInAt: Date.now(),
  };
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.add(attendee);
    await db.outbox.add({
      type: "check_in",
      eventId,
      attendeeId: attendee.id,
      qrToken: attendee.qrToken,
      name: attendee.name,
      at: attendee.checkedInAt!,
    });
  });
  return attendee;
}
