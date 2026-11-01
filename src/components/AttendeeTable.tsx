import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, QrCode, Search, Undo2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildQrPayload, checkInAttendee, undoCheckIn, type Attendee, type EventRecord } from "@/lib/db";
import { formatTime } from "@/lib/utils";

type Filter = "all" | "checked_in" | "pending";
const PAGE = 100;

export function AttendeeTable({ event, attendees }: { event: EventRecord; attendees: Attendee[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [qrFor, setQrFor] = useState<Attendee | null>(null);

  useEffect(() => setLimit(PAGE), [query, filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees
      .filter((a) => filter === "all" || a.status === filter)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "checked_in" ? -1 : 1;
        if (a.status === "checked_in") return (b.checkedInAt ?? 0) - (a.checkedInAt ?? 0);
        return a.name.localeCompare(b.name);
      });
  }, [attendees, query, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "checked_in", label: "Checked in" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search name, email or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-md border bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded px-3 py-1 text-sm transition ${filter === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Email</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{a.email}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{a.email || "—"}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">{a.externalId}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {a.status === "checked_in" ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3" /> {formatTime(a.checkedInAt)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {a.walkIn && <Badge>Walk-in</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Show QR" onClick={() => setQrFor(a)}>
                        <QrCode />
                      </Button>
                      {a.status === "checked_in" ? (
                        <Button size="icon" variant="ghost" title="Undo check-in" onClick={() => void undoCheckIn(a.id)}>
                          <Undo2 />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" title="Check in" onClick={() => void checkInAttendee(a.id)}>
                          <UserCheck />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {attendees.length === 0 ? "No attendees yet — import a spreadsheet above." : "No matches."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({filtered.length - limit} remaining)
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!qrFor} onOpenChange={(open) => !open && setQrFor(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center pr-0">
            <DialogTitle>{qrFor?.name}</DialogTitle>
            <DialogDescription>
              {event.title} · ID {qrFor?.externalId}
            </DialogDescription>
          </DialogHeader>
          {qrFor && (
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={buildQrPayload(event.id, qrFor.qrToken)} size={240} marginSize={1} />
            </div>
          )}
          <p className="font-mono text-xs text-muted-foreground">{qrFor?.qrToken}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
