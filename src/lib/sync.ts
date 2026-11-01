import { db } from "./db";

/**
 * Offline-first sync.
 *
 * Every check-in is written to IndexedDB immediately (so it survives reloads
 * and works with no network at all) AND appended to an "outbox". When a sync
 * endpoint is configured via VITE_SYNC_URL, the outbox is flushed whenever the
 * browser reports it's back online. Without an endpoint, the outbox simply
 * records that everything is stored locally.
 *
 * To plug in Supabase/Firebase, replace `pushBatch` with your client call.
 */
const SYNC_URL: string = import.meta.env.VITE_SYNC_URL ?? "";

let flushing = false;

async function pushBatch(items: Awaited<ReturnType<typeof db.outbox.toArray>>) {
  if (!SYNC_URL) return true; // nothing to push to — treat as synced locally
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkIns: items }),
  });
  return res.ok;
}

export async function flushOutbox(): Promise<{ pushed: number }> {
  if (flushing) return { pushed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { pushed: 0 };
  flushing = true;
  try {
    const pending = await db.outbox.where("synced").equals(0).toArray();
    if (pending.length === 0) return { pushed: 0 };
    const ok = await pushBatch(pending);
    if (!ok) return { pushed: 0 };
    await db.outbox.bulkUpdate(pending.map((p) => ({ key: p.id!, changes: { synced: 1 as const } })));
    return { pushed: pending.length };
  } catch {
    return { pushed: 0 };
  } finally {
    flushing = false;
  }
}

export function startSyncListener() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void flushOutbox();
  window.addEventListener("online", onOnline);
  // Retry periodically in case 'online' fires before connectivity is real.
  const timer = window.setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}

export const syncConfigured = Boolean(SYNC_URL);
