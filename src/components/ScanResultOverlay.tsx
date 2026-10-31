import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { CheckInResult } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = { success: 1800, duplicate: 3000, invalid: 2500 } as const;

export function ScanResultOverlay({ result, onDismiss }: { result: CheckInResult | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS[result.kind]);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  const config = {
    success: { bg: "bg-emerald-600", Icon: CheckCircle2, title: "Checked in" },
    duplicate: { bg: "bg-amber-500", Icon: AlertTriangle, title: "Already checked in" },
    invalid: { bg: "bg-red-600", Icon: XCircle, title: "Not valid" },
  }[result.kind];

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-8 text-center text-white",
        config.bg,
      )}
      aria-live="assertive"
    >
      <config.Icon className="h-28 w-28 animate-pop-in" strokeWidth={2.2} />
      <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">{config.title}</div>
      {result.kind !== "invalid" ? (
        <div className="space-y-1">
          <div className="text-2xl font-semibold">{result.attendee.name}</div>
          <div className="text-base opacity-90">ID {result.attendee.studentId}</div>
          {result.kind === "duplicate" ? (
            <div className="mt-2 rounded-full bg-black/15 px-4 py-1.5 text-lg font-medium">
              at {formatTime(result.attendee.checkedInAt)}
            </div>
          ) : (
            <div className="text-base opacity-90">{formatTime(result.attendee.checkedInAt)}</div>
          )}
          {result.attendee.walkIn && <div className="text-sm opacity-80">Walk-in</div>}
        </div>
      ) : (
        <div className="text-xl font-medium opacity-95">{result.reason}</div>
      )}
      <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] text-sm opacity-75">Tap to continue</div>
    </button>
  );
}
