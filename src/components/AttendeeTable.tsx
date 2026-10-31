import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, QrCode, Search, Trash2, Undo2 } from "lucide-react";
import { checkInById, deleteAttendee, qrPayload, undoCheckIn, type Attendee, type EventSession } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

type Filter = "all" | "in" | "pending" | "walkin";
const PAGE = 100;

export function matchesQuery(a: Attendee, q: string) {
  if (!q) return true;
  const s = q.toLowerCase();
  return a.fullName.toLowerCase().includes(s) || a.email.toLowerCase().includes(s) || a.ticketId.toLowerCase().includes(s);
}

export function AttendeeTable({ event, attendees }: { event: EventSession; attendees: Attendee[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [qrId, setQrId] = useState<string | null>(null);
  const qrFor = qrId ? (attendees.find((a) => a.id === qrId) ?? null) : null;

  const filtered = useMemo(() => {
    return attendees
      .filter((a) => matchesQuery(a, query.trim()))
      .filter((a) =>
        filter === "in" ? a.checkedIn : filter === "pending" ? !a.checkedIn : filter === "walkin" ? a.walkIn : true,
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [attendees, query, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search name, email or ID"
            className="pl-9"
          />
        </div>
        <div className="sm:w-48">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All ({attendees.length})</option>
            <option value="in">Checked in</option>
            <option value="pending">Not checked in</option>
            <option value="walkin">Walk-ins</option>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {attendees.length === 0 ? "No attendees yet — import a spreadsheet or add a walk-in." : "No matches."}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.slice(0, limit).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{a.fullName}</span>
                    {a.walkIn === 1 && <Badge variant="indigo">Walk-in</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {a.ticketId}
                    {a.email && ` · ${a.email}`}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  {a.checkedIn ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> Checked In · {formatTime(a.checkedInAt)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Checked In</Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="sm:hidden">
                    {a.checkedIn ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Checked in" />
                    ) : null}
                  </span>
                  <Button size="icon" variant="ghost" title="Show QR pass" onClick={() => setQrId(a.id)}>
                    <QrCode />
                  </Button>
                  {a.checkedIn ? (
                    <Button size="icon" variant="ghost" title="Undo check-in" onClick={() => undoCheckIn(a.id)}>
                      <Undo2 />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => checkInById(a.id)}>
                      Check in
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({filtered.length - limit} remaining)
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrId(null)}>
        <DialogContent className="max-w-sm">
          {qrFor && (
            <>
              <DialogHeader>
                <DialogTitle>{qrFor.fullName}</DialogTitle>
                <DialogDescription>
                  ID {qrFor.ticketId}
                  {qrFor.email && ` · ${qrFor.email}`}
                </DialogDescription>
              </DialogHeader>
              <div className="mx-auto rounded-xl border bg-white p-4">
                <QRCodeSVG value={qrPayload(event.id, qrFor.qrToken)} size={232} level="M" />
              </div>
              <div className="text-center text-sm">
                {qrFor.checkedIn ? (
                  <Badge variant="success">Checked in at {formatTime(qrFor.checkedInAt)}</Badge>
                ) : (
                  <Badge variant="secondary">Not Checked In</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={async () => {
                  if (confirm(`Remove ${qrFor.fullName} from this event?`)) {
                    await deleteAttendee(qrFor.id);
                    setQrId(null);
                  }
                }}
              >
                <Trash2 /> Remove attendee
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
