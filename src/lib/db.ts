import Dexie, { type EntityTable } from "dexie";
import { generateId, generateToken } from "./utils";

export interface EventRecord {
  id: string;
  title: string;
  date: string;
  location: string;
  organizer: string;
  capacity?: number;
  createdAt: number;
}

export type AttendeeStatus = "pending" | "checked_in";

export interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  studentId: string;
  qrToken: string;
  status: AttendeeStatus;
  checkedInAt?: number;
  walkIn: boolean;
  createdAt: number;
}

export interface OutboxItem {
  seq?: number;
  type: "check_in" | "undo_check_in";
  eventId: string;
  attendeeId: string;
  studentId: string;
  name: string;
  at: number;
}

class PassDB extends Dexie {
  events!: EntityTable<EventRecord, "id">;
  attendees!: EntityTable<Attendee, "id">;
  outbox!: EntityTable<OutboxItem, "seq">;

  constructor() {
    super("uel-evnt-pass");
    this.version(1).stores({
      events: "id, createdAt",
      attendees: "id, eventId, &qrToken, [eventId+email], [eventId+studentId], [eventId+status]",
      outbox: "++seq, at",
    });
  }
}

export const db = new PassDB();

// ---------- QR payload ----------

const QR_PREFIX = "EPC";

export function buildQrPayload(eventId: string, token: string): string {
  return `${QR_PREFIX}|${eventId}|${token}`;
}

/** Accepts `EPC|<eventId>|<token>` or a bare token. */
export function parseQrPayload(raw: string): { eventId?: string; token: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const parts = text.split("|");
  if (parts.length === 3 && parts[0] === QR_PREFIX && parts[2]) {
    return { eventId: parts[1], token: parts[2] };
  }
  if (parts.length === 1) return { token: text.toUpperCase() };
  return null;
}

// ---------- Events ----------

export async function createEvent(input: Omit<EventRecord, "id" | "createdAt">): Promise<string> {
  const id = generateId();
  await db.events.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function deleteEvent(eventId: string) {
  await db.transaction("rw", db.events, db.attendees, async () => {
    await db.attendees.where("eventId").equals(eventId).delete();
    await db.events.delete(eventId);
  });
}

// ---------- Attendees ----------

export function newAttendee(
  eventId: string,
  data: { name: string; email?: string; studentId?: string; walkIn?: boolean },
): Attendee {
  return {
    id: generateId(),
    eventId,
    name: data.name.trim(),
    email: (data.email ?? "").trim().toLowerCase(),
    studentId: (data.studentId ?? "").trim() || `GEN-${generateToken(6)}`,
    qrToken: generateToken(),
    status: "pending",
    walkIn: data.walkIn ?? false,
    createdAt: Date.now(),
  };
}

export type CheckInResult =
  | { kind: "success"; attendee: Attendee }
  | { kind: "duplicate"; attendee: Attendee }
  | { kind: "invalid"; reason: string };

async function markCheckedIn(attendee: Attendee): Promise<Attendee> {
  const at = Date.now();
  const updated: Attendee = { ...attendee, status: "checked_in", checkedInAt: at };
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.update(attendee.id, { status: "checked_in", checkedInAt: at });
    await db.outbox.add({
      type: "check_in",
      eventId: attendee.eventId,
      attendeeId: attendee.id,
      studentId: attendee.studentId,
      name: attendee.name,
      at,
    });
  });
  return updated;
}

/** Check in from a scanned QR string. */
export async function checkInByQr(eventId: string, raw: string): Promise<CheckInResult> {
  const parsed = parseQrPayload(raw);
  if (!parsed) return { kind: "invalid", reason: "QR not recognized" };
  if (parsed.eventId && parsed.eventId !== eventId) {
    return { kind: "invalid", reason: "This pass is for a different event" };
  }
  const attendee = await db.attendees.where("qrToken").equals(parsed.token).first();
  if (!attendee || attendee.eventId !== eventId) return { kind: "invalid", reason: "QR not recognized" };
  return checkInAttendee(attendee.id);
}

/** Check in a known attendee (manual search, walk-ins). */
export async function checkInAttendee(attendeeId: string): Promise<CheckInResult> {
  const attendee = await db.attendees.get(attendeeId);
  if (!attendee) return { kind: "invalid", reason: "Attendee not found" };
  if (attendee.status === "checked_in") return { kind: "duplicate", attendee };
  return { kind: "success", attendee: await markCheckedIn(attendee) };
}

export async function undoCheckIn(attendeeId: string) {
  const attendee = await db.attendees.get(attendeeId);
  if (!attendee || attendee.status !== "checked_in") return;
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.update(attendeeId, { status: "pending", checkedInAt: undefined });
    await db.outbox.add({
      type: "undo_check_in",
      eventId: attendee.eventId,
      attendeeId,
      studentId: attendee.studentId,
      name: attendee.name,
      at: Date.now(),
    });
  });
}

export async function deleteAttendee(attendeeId: string) {
  await db.attendees.delete(attendeeId);
}
