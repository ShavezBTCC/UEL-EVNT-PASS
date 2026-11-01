import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { CheckInResult } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  result: CheckInResult | null;
  onDismiss: () => void;
}

/** Full-screen, high-contrast verdict for door staff. Tap anywhere to dismiss. */
export function ScanResultOverlay({ result, onDismiss }: Props) {
  if (!result) return null;

  const base = "fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center text-white animate-pop-in";

  if (result.kind === "success") {
    const a = result.attendee;
    return (
      <div className={`${base} bg-emerald-600`} onClick={onDismiss} role="dialog" aria-live="assertive">
        <CheckCircle2 className="mb-4 h-28 w-28" strokeWidth={2.5} />
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-100">Checked in</p>
        <h2 className="mt-2 break-words text-4xl font-extrabold leading-tight sm:text-5xl">{a.fullName}</h2>
        <p className="mt-3 text-lg text-emerald-100">{a.ticketId}</p>
        {a.email && <p className="text-emerald-100/80">{a.email}</p>}
        <p className="mt-6 text-emerald-100">{formatTime(a.checkedInAt)}</p>
        <Button size="xl" variant="outline" className="mt-8 border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={onDismiss}>
          Next guest
        </Button>
      </div>
    );
  }

  if (result.kind === "duplicate") {
    const a = result.attendee;
    return (
      <div className={`${base} bg-amber-500`} onClick={onDismiss} role="dialog" aria-live="assertive">
        <AlertTriangle className="mb-4 h-28 w-28" strokeWidth={2.5} />
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-100">Duplicate</p>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">ALREADY CHECKED IN</h2>
        <p className="mt-2 text-xl font-semibold">at {formatDateTime(a.checkedInAt)}</p>
        <p className="mt-4 text-lg">{a.fullName}</p>
        <p className="text-amber-100">{a.ticketId}</p>
        <Button size="xl" variant="outline" className="mt-8 border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className={`${base} bg-red-600`} onClick={onDismiss} role="dialog" aria-live="assertive">
      <XCircle className="mb-4 h-28 w-28" strokeWidth={2.5} />
      <p className="text-sm font-semibold uppercase tracking-widest text-red-100">Invalid</p>
      <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">QR NOT RECOGNIZED</h2>
      <p className="mt-3 text-red-100">This code doesn't belong to this event's guest list.</p>
      <p className="mt-3 max-w-xs break-all font-mono text-xs text-red-200/70">{result.payload.slice(0, 120)}</p>
      <Button size="xl" variant="outline" className="mt-8 border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={onDismiss}>
        Try again
      </Button>
    </div>
  );
}
