import { db, type OutboxItem } from "./db";

const SYNC_URL = import.meta.env.VITE_SYNC_URL?.trim();
const BATCH_SIZE = 100;

let flushing = false;

/**
 * Sends a batch of outbox items to the configured backend.
 * Replace this with a Supabase / Firebase client call if you plug one in.
 */
async function pushBatch(items: OutboxItem[]) {
  if (!SYNC_URL) return;
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
}

export async function flushOutbox() {
  if (!SYNC_URL || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (;;) {
      const batch = await db.outbox.orderBy("at").limit(BATCH_SIZE).toArray();
      if (batch.length === 0) break;
      await pushBatch(batch);
      await db.outbox.bulkDelete(batch.map((i) => i.id!));
    }
  } catch (err) {
    console.warn("[sync] will retry later:", err);
  } finally {
    flushing = false;
  }
}

export function isSyncConfigured() {
  return Boolean(SYNC_URL);
}

export function startSyncListener() {
  if (!SYNC_URL) return;
  window.addEventListener("online", () => void flushOutbox());
  db.outbox.hook("creating", () => {
    // Defer until the creating transaction commits.
    setTimeout(() => void flushOutbox(), 500);
  });
  setInterval(() => void flushOutbox(), 60_000);
  void flushOutbox();
}
