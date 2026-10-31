import { db, type OutboxItem } from "./db";

const SYNC_URL = import.meta.env.VITE_SYNC_URL?.trim();
const BATCH_SIZE = 100;

let flushing = false;

/**
 * Sends a batch of outbox items to the remote endpoint.
 * Replace this with a Supabase/Firebase client call if you plug in a backend.
 */
async function pushBatch(items: OutboxItem[]): Promise<void> {
  if (!SYNC_URL) return;
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
}

export async function flushOutbox(): Promise<void> {
  if (!SYNC_URL || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (;;) {
      const batch = await db.outbox.orderBy("seq").limit(BATCH_SIZE).toArray();
      if (batch.length === 0) break;
      await pushBatch(batch);
      await db.outbox.bulkDelete(batch.map((i) => i.seq!));
    }
  } catch (err) {
    console.warn("[sync] will retry when back online", err);
  } finally {
    flushing = false;
  }
}

export function startSyncListener() {
  if (!SYNC_URL) return;
  window.addEventListener("online", () => void flushOutbox());
  // Pick up check-ins as they happen, plus a periodic retry.
  db.outbox.hook("creating", () => {
    setTimeout(() => void flushOutbox(), 500);
  });
  setInterval(() => void flushOutbox(), 60_000);
  void flushOutbox();
}

export const syncEnabled = Boolean(SYNC_URL);
