import Dexie, { type Table } from "dexie";
import { generateToken } from "./utils";

export interface EventSession {
  id: string;
  title: string;
  date: string;
  location: string;
  organizer: string;
  capacity?: number | null;
  createdAt: number;
}

export interface Attendee {
  id: string;
  eventId: string;
  fullName: string;
  email: string;
  ticketId: string;
  qrToken: string;
  checkedIn: 0 | 1;
  checkedInAt: number | null;
  walkIn: 0 | 1;
  createdAt: number;
}

export interface OutboxItem {
  id?: number;
  type: "checkin" | "undo";
  eventId: string;
  attendeeId: string;
  ticketId: string;
  fullName: string;
  at: number;
}

class EventPassDB extends Dexie {
  events!: Table<EventSession, string>;
  attendees!: Table<Attendee, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super("uel-evnt-pass");
    this.version(1).stores({
      events: "id, createdAt",
      attendees: "id, eventId, qrToken, [eventId+checkedIn], [eventId+ticketId], [eventId+email]",
      outbox: "++id, at",
    });
  }
}

export const db = new EventPassDB();

/* ---------------- QR payload format ---------------- */

const QR_PREFIX = "EPC";

export function qrPayload(eventId: string, token: string): string {
  return `${QR_PREFIX}|${eventId}|${token}`;
}

export function parseQrPayload(raw: string): { eventId: string | null; token: string } {
  const text = raw.trim();
  const parts = text.split("|");
  if (parts.length === 3 && parts[0] === QR_PREFIX) return { eventId: parts[1], token: parts[2] };
  return { eventId: null, token: text };
}

/* ---------------- Events ---------------- */

export async function createEvent(input: Omit<EventSession, "id" | "createdAt">): Promise<string> {
  const id = generateToken(10);
  await db.events.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await db.transaction("rw", db.events, db.attendees, async () => {
    await db.attendees.where("eventId").equals(eventId).delete();
    await db.events.delete(eventId);
  });
}

/* ---------------- Attendees ---------------- */

export function newAttendee(
  eventId: string,
  data: { fullName: string; email?: string; ticketId?: string; walkIn?: boolean },
): Attendee {
  return {
    id: generateToken(12),
    eventId,
    fullName: data.fullName.trim(),
    email: (data.email ?? "").trim(),
    ticketId: (data.ticketId ?? "").trim() || `T-${generateToken(6).toUpperCase()}`,
    qrToken: generateToken(20),
    checkedIn: 0,
    checkedInAt: null,
    walkIn: data.walkIn ? 1 : 0,
    createdAt: Date.now(),
  };
}

async function enqueue(type: OutboxItem["type"], a: Attendee, at: number) {
  await db.outbox.add({ type, eventId: a.eventId, attendeeId: a.id, ticketId: a.ticketId, fullName: a.fullName, at });
}

export type CheckInResult =
  | { status: "success"; attendee: Attendee }
  | { status: "duplicate"; attendee: Attendee }
  | { status: "invalid"; raw: string };

/** Checks an attendee in by id. Atomic, so two quick scans can't both succeed. */
export async function checkInById(attendeeId: string): Promise<CheckInResult> {
  return db.transaction("rw", db.attendees, db.outbox, async () => {
    const a = await db.attendees.get(attendeeId);
    if (!a) return { status: "invalid", raw: attendeeId } as const;
    if (a.checkedIn) return { status: "duplicate", attendee: a } as const;
    const at = Date.now();
    const updated: Attendee = { ...a, checkedIn: 1, checkedInAt: at };
    await db.attendees.put(updated);
    await enqueue("checkin", updated, at);
    return { status: "success", attendee: updated } as const;
  });
}

/** Resolves a scanned QR string for the given event and checks the attendee in. */
export async function checkInByQr(eventId: string, raw: string): Promise<CheckInResult> {
  const { eventId: qrEvent, token } = parseQrPayload(raw);
  if (!token || (qrEvent && qrEvent !== eventId)) return { status: "invalid", raw };
  const a = await db.attendees.where("qrToken").equals(token).first();
  if (!a || a.eventId !== eventId) return { status: "invalid", raw };
  return checkInById(a.id);
}

export async function undoCheckIn(attendeeId: string): Promise<void> {
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    const a = await db.attendees.get(attendeeId);
    if (!a || !a.checkedIn) return;
    const updated: Attendee = { ...a, checkedIn: 0, checkedInAt: null };
    await db.attendees.put(updated);
    await enqueue("undo", updated, Date.now());
  });
}

export async function deleteAttendee(attendeeId: string): Promise<void> {
  await db.attendees.delete(attendeeId);
}
