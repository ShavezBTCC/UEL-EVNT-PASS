import Dexie, { type Table } from "dexie";
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
  externalId: string;
  qrToken: string;
  status: AttendeeStatus;
  checkedInAt?: number;
  walkIn: boolean;
  createdAt: number;
}

export interface OutboxItem {
  id?: number;
  type: "check_in" | "undo_check_in";
  eventId: string;
  attendeeId: string;
  qrToken: string;
  name: string;
  at: number;
}

class EventPassDB extends Dexie {
  events!: Table<EventRecord, string>;
  attendees!: Table<Attendee, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super("uel-evnt-pass");
    this.version(1).stores({
      events: "id, createdAt",
      attendees: "id, eventId, qrToken, [eventId+status], [eventId+externalId], [eventId+email]",
      outbox: "++id, at",
    });
  }
}

export const db = new EventPassDB();

/* ---------- QR payload ---------- */

export const QR_PREFIX = "EPC";

export function buildQrPayload(eventId: string, token: string) {
  return `${QR_PREFIX}|${eventId}|${token}`;
}

/** Accepts `EPC|<eventId>|<token>` or a bare token. */
export function parseQrPayload(raw: string): { eventId?: string; token: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const parts = text.split("|");
  if (parts.length === 3 && parts[0] === QR_PREFIX) {
    return { eventId: parts[1], token: parts[2] };
  }
  if (/^[A-Za-z0-9_-]{4,64}$/.test(text)) return { token: text };
  return null;
}

/* ---------- Events ---------- */

export type NewEvent = Omit<EventRecord, "id" | "createdAt">;

export async function createEvent(input: NewEvent) {
  const event: EventRecord = { ...input, id: generateId(), createdAt: Date.now() };
  await db.events.add(event);
  return event;
}

export async function deleteEvent(eventId: string) {
  await db.transaction("rw", db.events, db.attendees, async () => {
    await db.attendees.where("eventId").equals(eventId).delete();
    await db.events.delete(eventId);
  });
}

/* ---------- Attendees ---------- */

export function newAttendee(eventId: string, data: { name: string; email?: string; externalId?: string; walkIn?: boolean }): Attendee {
  return {
    id: generateId(),
    eventId,
    name: data.name.trim(),
    email: (data.email ?? "").trim(),
    externalId: (data.externalId ?? "").trim() || generateToken(8),
    qrToken: generateToken(),
    status: "pending",
    walkIn: data.walkIn ?? false,
    createdAt: Date.now(),
  };
}

export async function getEventAttendees(eventId: string) {
  return db.attendees.where("eventId").equals(eventId).toArray();
}

/* ---------- Check-in ---------- */

export type CheckInResult =
  | { kind: "success"; attendee: Attendee }
  | { kind: "duplicate"; attendee: Attendee }
  | { kind: "wrong_event"; attendee: Attendee }
  | { kind: "not_found" };

export async function checkInAttendee(attendeeId: string): Promise<CheckInResult> {
  return db.transaction("rw", db.attendees, db.outbox, async () => {
    const attendee = await db.attendees.get(attendeeId);
    if (!attendee) return { kind: "not_found" } as const;
    if (attendee.status === "checked_in") return { kind: "duplicate", attendee } as const;
    const at = Date.now();
    const updated: Attendee = { ...attendee, status: "checked_in", checkedInAt: at };
    await db.attendees.put(updated);
    await db.outbox.add({
      type: "check_in",
      eventId: attendee.eventId,
      attendeeId: attendee.id,
      qrToken: attendee.qrToken,
      name: attendee.name,
      at,
    });
    return { kind: "success", attendee: updated } as const;
  });
}

export async function checkInByQr(eventId: string, raw: string): Promise<CheckInResult> {
  const parsed = parseQrPayload(raw);
  if (!parsed) return { kind: "not_found" };
  const matches = await db.attendees.where("qrToken").equals(parsed.token).toArray();
  if (matches.length === 0) return { kind: "not_found" };
  const attendee = matches.find((a) => a.eventId === eventId);
  if (!attendee) return { kind: "wrong_event", attendee: matches[0] };
  return checkInAttendee(attendee.id);
}

export async function undoCheckIn(attendeeId: string) {
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    const attendee = await db.attendees.get(attendeeId);
    if (!attendee || attendee.status !== "checked_in") return;
    await db.attendees.update(attendeeId, { status: "pending", checkedInAt: undefined });
    await db.outbox.add({
      type: "undo_check_in",
      eventId: attendee.eventId,
      attendeeId: attendee.id,
      qrToken: attendee.qrToken,
      name: attendee.name,
      at: Date.now(),
    });
  });
}

export interface EventStats {
  total: number;
  checkedIn: number;
  pending: number;
  walkIns: number;
}

export function computeStats(attendees: Attendee[]): EventStats {
  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  return {
    total: attendees.length,
    checkedIn,
    pending: attendees.length - checkedIn,
    walkIns: attendees.filter((a) => a.walkIn).length,
  };
}
