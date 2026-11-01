import { useMemo, useState } from "react";
import { Search, QrCode, Undo2, UserCheck, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildQrPayload, checkInAttendee, db, undoCheckIn, type Attendee, type EventSession } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

type Filter = "all" | "pending" | "checked_in";

export function AttendeeTable({ attendees, event }: { attendees: Attendee[]; event: EventSession }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [qrFor, setQrFor] = useState<Attendee | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return attendees
      .filter((a) => (filter === "all" ? true : a.status === filter))
      .filter(
        (a) =>
          !needle ||
          a.fullName.toLowerCase().includes(needle) ||
          a.email.toLowerCase().includes(needle) ||
          a.ticketId.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [attendees, q, filter]);

  const remove = async (a: Attendee) => {
    if (confirm(`Remove ${a.fullName} from the guest list?`)) await db.attendees.delete(a.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search name, email or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["checked_in", "Checked in"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                filter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {list.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {attendees.length === 0 ? "No attendees yet — import a sheet or add a walk-in." : "No attendees match your search."}
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-slate-900">{a.fullName}</span>
                    {a.isWalkIn && <Badge variant="secondary">Walk-in</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {a.ticketId}
                    {a.email ? ` · ${a.email}` : ""}
                  </div>
                  {a.status === "checked_in" && (
                    <div className="mt-0.5 text-xs text-emerald-700">Checked in {formatDateTime(a.checkedInAt)}</div>
                  )}
                </div>
                {a.status === "checked_in" ? (
                  <Badge variant="success">Checked In</Badge>
                ) : (
                  <Badge variant="warning">Not Checked In</Badge>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" title="Show QR" onClick={() => setQrFor(a)}>
                    <QrCode />
                  </Button>
                  {a.status === "checked_in" ? (
                    <Button size="icon" variant="ghost" title="Undo check-in" onClick={() => undoCheckIn(a)}>
                      <Undo2 />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" title="Check in" className="text-emerald-700" onClick={() => checkInAttendee(a)}>
                      <UserCheck />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Remove" className="text-slate-400 hover:text-red-600" onClick={() => remove(a)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Showing {list.length} of {attendees.length}
      </p>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          {qrFor && (
            <>
              <DialogHeader>
                <DialogTitle>{qrFor.fullName}</DialogTitle>
                <DialogDescription>
                  {qrFor.ticketId}
                  {qrFor.email ? ` · ${qrFor.email}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-xl bg-white p-4">
                <QRCodeSVG value={buildQrPayload(event.id, qrFor.qrToken)} size={240} level="M" marginSize={2} />
              </div>
              <p className="break-all text-center font-mono text-[11px] text-slate-400">{qrFor.qrToken}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
