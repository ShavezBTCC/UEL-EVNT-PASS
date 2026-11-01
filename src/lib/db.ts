import Dexie, { type EntityTable } from "dexie";

export interface EventSession {
  id: string;
  title: string;
  date: string; // ISO date (yyyy-mm-dd)
  location: string;
  organizer: string;
  capacity?: number; // optional, for the capacity progress bar
  createdAt: number;
}

export type AttendeeStatus = "pending" | "checked_in";

export interface Attendee {
  id: string; // internal uuid
  eventId: string;
  fullName: string;
  email: string;
  ticketId: string; // Student ID / Ticket ID from the sheet
  qrToken: string; // unique hash embedded in the QR
  status: AttendeeStatus;
  checkedInAt?: number; // epoch ms
  isWalkIn: boolean;
  createdAt: number;
}

export interface OutboxItem {
  id?: number;
  eventId: string;
  attendeeId: string;
  action: "check_in" | "undo_check_in";
  timestamp: number;
  synced: 0 | 1;
}

class UelEvntPassDB extends Dexie {
  events!: EntityTable<EventSession, "id">;
  attendees!: EntityTable<Attendee, "id">;
  outbox!: EntityTable<OutboxItem, "id">;

  constructor() {
    super("uel-evnt-pass");
    this.version(1).stores({
      events: "id, createdAt, date",
      attendees: "id, eventId, qrToken, ticketId, status, [eventId+status], [eventId+qrToken]",
      outbox: "++id, synced, eventId",
    });
  }
}

export const db = new UelEvntPassDB();

// ---- helpers -------------------------------------------------------------

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function createEvent(input: Omit<EventSession, "id" | "createdAt">): Promise<EventSession> {
  const ev: EventSession = { ...input, id: uuid(), createdAt: Date.now() };
  await db.events.add(ev);
  return ev;
}

export async function deleteEvent(eventId: string) {
  await db.transaction("rw", db.events, db.attendees, db.outbox, async () => {
    await db.attendees.where("eventId").equals(eventId).delete();
    await db.outbox.where("eventId").equals(eventId).delete();
    await db.events.delete(eventId);
  });
}

export type CheckInResult =
  | { kind: "success"; attendee: Attendee }
  | { kind: "duplicate"; attendee: Attendee }
  | { kind: "invalid"; payload: string };

/** Verify a scanned QR payload against the guest list and check the attendee in. */
export async function checkInByToken(eventId: string, payload: string): Promise<CheckInResult> {
  const token = extractToken(payload);
  if (!token) return { kind: "invalid", payload };
  const attendee = await db.attendees.where("[eventId+qrToken]").equals([eventId, token]).first();
  if (!attendee) return { kind: "invalid", payload };
  return checkInAttendee(attendee);
}

/** Check an attendee in by record (used by the manual search fallback). */
export async function checkInAttendee(attendee: Attendee): Promise<CheckInResult> {
  if (attendee.status === "checked_in") return { kind: "duplicate", attendee };
  const checkedInAt = Date.now();
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.update(attendee.id, { status: "checked_in", checkedInAt });
    await db.outbox.add({
      eventId: attendee.eventId,
      attendeeId: attendee.id,
      action: "check_in",
      timestamp: checkedInAt,
      synced: 0,
    });
  });
  return { kind: "success", attendee: { ...attendee, status: "checked_in", checkedInAt } };
}

export async function undoCheckIn(attendee: Attendee) {
  await db.transaction("rw", db.attendees, db.outbox, async () => {
    await db.attendees.update(attendee.id, { status: "pending", checkedInAt: undefined });
    await db.outbox.add({
      eventId: attendee.eventId,
      attendeeId: attendee.id,
      action: "undo_check_in",
      timestamp: Date.now(),
      synced: 0,
    });
  });
}

/**
 * QR payload format: `EPC|<eventId>|<token>`.
 * We accept either the full payload or a bare token so that
 * passes printed from any source still scan.
 */
export const QR_PREFIX = "EPC";

export function buildQrPayload(eventId: string, token: string) {
  return `${QR_PREFIX}|${eventId}|${token}`;
}

export function extractToken(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("|");
  if (parts.length === 3 && parts[0] === QR_PREFIX) return parts[2];
  if (parts.length === 1) return trimmed;
  return null;
}
