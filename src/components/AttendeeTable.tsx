import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, RotateCcw, Search, Trash2, UserCheck } from "lucide-react";
import { buildQrPayload, checkInAttendee, deleteAttendee, undoCheckIn, type Attendee } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Filter = "all" | "checked_in" | "pending" | "walk_in";
const PAGE = 100;

export function AttendeeTable({ attendees, eventId }: { attendees: Attendee[]; eventId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [qrFor, setQrFor] = useState<Attendee | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees
      .filter((a) => {
        if (filter === "checked_in" && a.status !== "checked_in") return false;
        if (filter === "pending" && a.status !== "pending") return false;
        if (filter === "walk_in" && !a.walkIn) return false;
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) || a.email.includes(q) || a.studentId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, query, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email or ID…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            className="pl-9"
          />
        </div>
        <div className="sm:w-44">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All attendees</option>
            <option value="checked_in">Checked in</option>
            <option value="pending">Not arrived</option>
            <option value="walk_in">Walk-ins</option>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                <tr key={a.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{a.studentId}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{a.email || "—"}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">{a.studentId}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {a.status === "checked_in" ? (
                        <Badge variant="success">✓ {formatTime(a.checkedInAt)}</Badge>
                      ) : (
                        <Badge variant="secondary">Not arrived</Badge>
                      )}
                      {a.walkIn && <Badge variant="outline">Walk-in</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Show QR pass" onClick={() => setQrFor(a)}>
                        <QrCode />
                      </Button>
                      {a.status === "checked_in" ? (
                        <Button variant="ghost" size="icon" title="Undo check-in" onClick={() => undoCheckIn(a.id)}>
                          <RotateCcw />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Check in" onClick={() => checkInAttendee(a.id)}>
                          <UserCheck />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove attendee"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`Remove ${a.name} from this event?`)) void deleteAttendee(a.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
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

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          {qrFor && (
            <>
              <DialogHeader>
                <DialogTitle>{qrFor.name}</DialogTitle>
                <DialogDescription>ID {qrFor.studentId}</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={buildQrPayload(eventId, qrFor.qrToken)} size={240} marginSize={1} />
              </div>
              <p className="text-center font-mono text-xs text-muted-foreground">Pass code {qrFor.qrToken}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
