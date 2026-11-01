import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, CalendarDays, MapPin, User, ChevronRight, ScanLine, Trash2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createEvent, db, deleteEvent } from "@/lib/db";
import { formatEventDate } from "@/lib/utils";

export default function Dashboard() {
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.attendees.toArray();
    const m: Record<string, { total: number; checkedIn: number }> = {};
    for (const a of all) {
      m[a.eventId] ??= { total: 0, checkedIn: 0 };
      m[a.eventId].total++;
      if (a.status === "checked_in") m[a.eventId].checkedIn++;
    }
    return m;
  }, []);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      right={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New event
        </Button>
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Event Sessions</h1>
        <p className="text-sm text-slate-500">Create a session, import your guest list, and start scanning at the door.</p>
      </div>

      {events === undefined ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
            <CalendarDays className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">No events yet</h2>
            <p className="text-sm text-slate-500">Create your first event session to get started.</p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            <Plus /> Create new event
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const c = counts?.[ev.id] ?? { total: 0, checkedIn: 0 };
            const pct = c.total ? Math.round((c.checkedIn / c.total) * 100) : 0;
            return (
              <Card key={ev.id} className="group relative flex flex-col overflow-hidden transition hover:shadow-md">
                <Link to={`/event/${ev.id}`} className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900">{ev.title}</h2>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-indigo-600" />
                  </div>
                  <dl className="space-y-1.5 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" /> {formatEventDate(ev.date)}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" /> {ev.location}
                      </div>
                    )}
                    {ev.organizer && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" /> {ev.organizer}
                      </div>
                    )}
                  </dl>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                      <span>
                        {c.checkedIn} / {c.total} checked in
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t bg-slate-50 px-3 py-2">
                  <Button asChild size="sm" variant="ghost" className="text-indigo-700">
                    <Link to={`/scan/${ev.id}`}>
                      <ScanLine /> Open scanner
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => confirm(`Delete "${ev.title}" and all its attendees? This cannot be undone.`) && deleteEvent(ev.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateEventDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const ev = await createEvent({
        title: title.trim(),
        date,
        location: location.trim(),
        organizer: organizer.trim(),
        capacity: capacity ? Number(capacity) : undefined,
      });
      onOpenChange(false);
      navigate(`/event/${ev.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
            <DialogDescription>You'll import the guest list on the next screen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Event title *</Label>
            <Input id="ev-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Freshers' Welcome Night" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date *</Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cap">Capacity (optional)</Label>
              <Input id="ev-cap" type="number" min={1} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 300" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Auditorium, Block C" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-org">Organizer name</Label>
            <Input id="ev-org" value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="Student Council" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || busy}>
              {busy && <Loader2 className="animate-spin" />} Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
