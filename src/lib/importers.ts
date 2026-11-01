import * as XLSX from "xlsx";
import { db, uuid, type Attendee } from "./db";
import { generateQrToken } from "./utils";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
}

export interface ColumnMapping {
  fullName: string;
  email: string;
  ticketId: string;
}

/** Parse the first sheet of an .xlsx/.xls/.csv file into headers + string rows. */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets.");
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (raw.length === 0) throw new Error("No rows found in the first sheet.");
  const headers = Object.keys(raw[0]);
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = String(r[h] ?? "").trim();
    return out;
  });
  return { headers, rows, fileName: file.name };
}

/** Best-effort guess of which column maps to which field. */
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.toLowerCase().replace(/[_\s-]+/g, " ")))) ?? "";
  return {
    fullName: find([/^(full )?name$/, /name/, /attendee/, /student$/]),
    email: find([/e ?mail/]),
    ticketId: find([/ticket/, /student ?id/, /roll/, /reg/, /\bid\b/, /matric/]),
  };
}

export interface ImportSummary {
  added: number;
  skippedDuplicates: number;
  skippedEmpty: number;
}

/**
 * Import mapped rows into an event. Each attendee gets a unique QR token.
 * Rows whose ticketId already exists in this event are skipped.
 */
export async function importAttendees(
  eventId: string,
  sheet: ParsedSheet,
  mapping: ColumnMapping,
): Promise<ImportSummary> {
  const existing = await db.attendees.where("eventId").equals(eventId).toArray();
  const existingIds = new Set(existing.map((a) => a.ticketId.toLowerCase()).filter(Boolean));
  const existingEmails = new Set(existing.map((a) => a.email.toLowerCase()).filter(Boolean));

  const toAdd: Attendee[] = [];
  let skippedDuplicates = 0;
  let skippedEmpty = 0;
  const now = Date.now();

  for (const row of sheet.rows) {
    const fullName = row[mapping.fullName] ?? "";
    const email = row[mapping.email] ?? "";
    let ticketId = row[mapping.ticketId] ?? "";
    if (!fullName) {
      skippedEmpty++;
      continue;
    }
    if (!ticketId) ticketId = email || `AUTO-${uuid().slice(0, 8).toUpperCase()}`;
    const key = ticketId.toLowerCase();
    if (existingIds.has(key) || (email && existingEmails.has(email.toLowerCase()))) {
      skippedDuplicates++;
      continue;
    }
    existingIds.add(key);
    if (email) existingEmails.add(email.toLowerCase());
    toAdd.push({
      id: uuid(),
      eventId,
      fullName,
      email,
      ticketId,
      qrToken: generateQrToken(),
      status: "pending",
      isWalkIn: false,
      createdAt: now,
    });
  }

  if (toAdd.length) await db.attendees.bulkAdd(toAdd);
  return { added: toAdd.length, skippedDuplicates, skippedEmpty };
}

export async function addWalkIn(
  eventId: string,
  input: { fullName: string; email?: string; ticketId?: string; checkInNow?: boolean },
): Promise<Attendee> {
  const now = Date.now();
  const attendee: Attendee = {
    id: uuid(),
    eventId,
    fullName: input.fullName.trim(),
    email: (input.email ?? "").trim(),
    ticketId: (input.ticketId ?? "").trim() || `WALKIN-${uuid().slice(0, 6).toUpperCase()}`,
    qrToken: generateQrToken(),
    status: input.checkInNow ? "checked_in" : "pending",
    checkedInAt: input.checkInNow ? now : undefined,
    isWalkIn: true,
    createdAt: now,
  };
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.add(attendee);
    if (input.checkInNow) {
      await db.outbox.add({ eventId, attendeeId: attendee.id, action: "check_in", timestamp: now, synced: 0 });
    }
  });
  return attendee;
}
