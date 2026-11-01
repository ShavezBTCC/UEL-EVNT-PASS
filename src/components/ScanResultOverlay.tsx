import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { CheckInResult } from "@/lib/db";
import { formatTime } from "@/lib/utils";

interface Props {
  result: CheckInResult | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function ScanResultOverlay({ result, onDismiss, autoDismissMs = 2200 }: Props) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, result.kind === "success" ? autoDismissMs : autoDismissMs + 1300);
    return () => clearTimeout(t);
  }, [result, onDismiss, autoDismissMs]);

  if (!result) return null;

  let tone = "bg-red-600";
  let Icon = XCircle;
  let title = "QR not recognized";
  let subtitle = "This code isn't on the guest list.";
  let name: string | undefined;
  let detail: string | undefined;

  if (result.kind === "success") {
    tone = "bg-emerald-600";
    Icon = CheckCircle2;
    title = "Checked in";
    name = result.attendee.name;
    subtitle = formatTime(result.attendee.checkedInAt);
    detail = result.attendee.externalId;
  } else if (result.kind === "duplicate") {
    tone = "bg-amber-500";
    Icon = AlertTriangle;
    title = `Already checked in at ${formatTime(result.attendee.checkedInAt)}`;
    name = result.attendee.name;
    subtitle = "This pass has been used.";
    detail = result.attendee.externalId;
  } else if (result.kind === "wrong_event") {
    title = "Pass is for a different event";
    name = result.attendee.name;
    subtitle = "Ask the guest to show the pass for this event.";
  }

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`fixed inset-0 z-50 flex animate-pop-in flex-col items-center justify-center gap-4 p-8 text-center text-white ${tone}`}
    >
      <Icon className="h-28 w-28 drop-shadow" strokeWidth={2.2} />
      <div className="text-2xl font-bold sm:text-3xl">{title}</div>
      {name && <div className="text-3xl font-extrabold sm:text-5xl">{name}</div>}
      {detail && <div className="font-mono text-lg opacity-90">{detail}</div>}
      <div className="text-lg opacity-90">{subtitle}</div>
      <div className="mt-6 text-sm opacity-75">Tap to continue</div>
    </button>
  );
}
