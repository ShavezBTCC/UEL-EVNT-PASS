import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { CheckInResult } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = { success: 2200, duplicate: 3500, invalid: 3000 };

export function ScanResultOverlay({ result, onDismiss }: { result: CheckInResult | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS[result.status]);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  const cfg = {
    success: { bg: "bg-emerald-600", Icon: CheckCircle2, title: "CHECKED IN" },
    duplicate: { bg: "bg-amber-500", Icon: AlertTriangle, title: "ALREADY CHECKED IN" },
    invalid: { bg: "bg-rose-600", Icon: XCircle, title: "QR NOT RECOGNIZED" },
  }[result.status];
  const { Icon } = cfg;

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-6 text-center text-white",
        cfg.bg,
      )}
      aria-live="assertive"
    >
      <Icon className="h-28 w-28 animate-pop-in drop-shadow" strokeWidth={2.2} />
      <div className="text-3xl font-black tracking-tight sm:text-5xl">{cfg.title}</div>
      {result.status !== "invalid" ? (
        <div className="space-y-1">
          <div className="text-2xl font-bold sm:text-4xl">{result.attendee.fullName}</div>
          <div className="text-lg opacity-90">ID: {result.attendee.ticketId}</div>
          {result.attendee.email && <div className="opacity-80">{result.attendee.email}</div>}
          {result.status === "duplicate" ? (
            <div className="mt-3 rounded-xl bg-black/20 px-4 py-2 text-xl font-bold">
              at {formatTime(result.attendee.checkedInAt)}
            </div>
          ) : (
            <div className="mt-3 text-lg opacity-90">{formatTime(result.attendee.checkedInAt)}</div>
          )}
          {result.attendee.walkIn === 1 && <div className="text-sm uppercase tracking-wider opacity-80">Walk-in</div>}
        </div>
      ) : (
        <div className="max-w-sm text-lg opacity-90">This pass isn't on the guest list for this event.</div>
      )}
      <div className="absolute bottom-8 text-sm opacity-75">Tap anywhere to continue</div>
    </button>
  );
}
