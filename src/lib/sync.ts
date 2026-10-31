import { db, type OutboxItem } from "./db";

const SYNC_URL = import.meta.env.VITE_SYNC_URL?.trim();

/**
 * Sends a batch of queued check-ins to the configured backend.
 * Replace this with a Supabase/Firebase call to use a different backend.
 */
async function pushBatch(items: OutboxItem[]): Promise<void> {
  const res = await fetch(SYNC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
}

let flushing = false;

export async function flushOutbox(): Promise<number> {
  if (!SYNC_URL || flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (;;) {
      const batch = await db.outbox.orderBy("at").limit(100).toArray();
      if (batch.length === 0) break;
      await pushBatch(batch);
      await db.outbox.bulkDelete(batch.map((b) => b.id!));
      sent += batch.length;
    }
  } catch (err) {
    console.warn("[sync]", err);
  } finally {
    flushing = false;
  }
  return sent;
}

export function startSyncListener() {
  if (!SYNC_URL) return;
  window.addEventListener("online", () => void flushOutbox());
  setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
}

export const syncEnabled = Boolean(SYNC_URL);
