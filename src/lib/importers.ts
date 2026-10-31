import * as XLSX from "xlsx";
import { db, newAttendee, type Attendee } from "./db";

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

export interface ColumnMapping {
  name: number;
  email: number; // -1 = none
  studentId: number; // -1 = none
}

export async function parseSheet(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("The file has no sheets.");
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
  const [head = [], ...body] = data;
  const headers = head.map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
  const rows = body
    .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (headers.length === 0) throw new Error("Couldn't find a header row.");
  return { headers, rows };
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const p of patterns) {
    const idx = lower.findIndex((h) => p.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function guessColumns(headers: string[]): ColumnMapping {
  const name = findColumn(headers, [/^full\s*name$/, /^name$/, /full.?name/, /student.?name/, /attendee/, /name/]);
  const email = findColumn(headers, [/^e-?mail/, /mail/]);
  const studentId = findColumn(headers, [/student.?(id|no|number)/, /ticket/, /^id$/, /\bid\b/, /number/]);
  return { name: name === -1 ? 0 : name, email, studentId: studentId === name ? -1 : studentId };
}

export interface ImportResult {
  added: number;
  skippedDuplicates: number;
  skippedEmpty: number;
}

export async function importAttendees(eventId: string, sheet: ParsedSheet, map: ColumnMapping): Promise<ImportResult> {
  const existing = await db.attendees.where("eventId").equals(eventId).toArray();
  const seenEmails = new Set(existing.map((a) => a.email).filter(Boolean));
  const seenIds = new Set(existing.map((a) => a.studentId.toLowerCase()).filter(Boolean));

  const toAdd: Attendee[] = [];
  let skippedDuplicates = 0;
  let skippedEmpty = 0;

  for (const row of sheet.rows) {
    const name = row[map.name]?.trim() ?? "";
    if (!name) {
      skippedEmpty++;
      continue;
    }
    const email = map.email >= 0 ? (row[map.email] ?? "").trim().toLowerCase() : "";
    const studentId = map.studentId >= 0 ? (row[map.studentId] ?? "").trim() : "";
    if ((email && seenEmails.has(email)) || (studentId && seenIds.has(studentId.toLowerCase()))) {
      skippedDuplicates++;
      continue;
    }
    const attendee = newAttendee(eventId, { name, email, studentId });
    if (attendee.email) seenEmails.add(attendee.email);
    seenIds.add(attendee.studentId.toLowerCase());
    toAdd.push(attendee);
  }

  await db.attendees.bulkAdd(toAdd);
  return { added: toAdd.length, skippedDuplicates, skippedEmpty };
}

export async function addWalkIn(
  eventId: string,
  data: { name: string; email?: string; studentId?: string },
): Promise<Attendee> {
  const attendee = newAttendee(eventId, { ...data, walkIn: true });
  if (attendee.email) {
    const dup = await db.attendees.where("[eventId+email]").equals([eventId, attendee.email]).first();
    if (dup) throw new Error(`${dup.name} is already registered with that email.`);
  }
  const dupId = await db.attendees.where("[eventId+studentId]").equals([eventId, attendee.studentId]).first();
  if (dupId) throw new Error(`${dupId.name} is already registered with that ID.`);
  await db.attendees.add(attendee);
  return attendee;
}
