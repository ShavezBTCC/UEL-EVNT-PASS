import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, ChevronRight, MapPin, Plus, ScanLine, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createEvent, db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    location: "",
    organizer: "",
    capacity: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const cap = parseInt(form.capacity, 10);
      const id = await createEvent({
        title: form.title.trim(),
        date: form.date,
        location: form.location.trim(),
        organizer: form.organizer.trim(),
        capacity: Number.isFinite(cap) && cap > 0 ? cap : null,
      });
      onOpenChange(false);
      navigate(`/event/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
            <DialogDescription>You can import attendees on the next screen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Event title *</Label>
            <Input id="ev-title" required autoFocus value={form.title} onChange={set("title")} placeholder="Freshers' Welcome Night" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" type="date" value={form.date} onChange={set("date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cap">Capacity</Label>
              <Input id="ev-cap" type="number" min={1} inputMode="numeric" value={form.capacity} onChange={set("capacity")} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={form.location} onChange={set("location")} placeholder="Main Hall, Docklands Campus" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-org">Organizer name</Label>
            <Input id="ev-org" value={form.organizer} onChange={set("organizer")} placeholder="Student Union" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.title.trim()}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const events = useLiveQuery(() => db.events.orderBy("createdAt").reverse().toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.attendees.toArray();
    const map: Record<string, { total: number; in: number }> = {};
    for (const a of all) {
      const c = (map[a.eventId] ??= { total: 0, in: 0 });
      c.total++;
      if (a.checkedIn) c.in++;
    }
    return map;
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Event sessions</h1>
          <p className="text-slate-500">Create an event, import guests, scan passes at the door.</p>
        </div>
        <Button size="lg" onClick={() => setOpen(true)}>
          <Plus /> Create new event
        </Button>
      </div>

      {events === undefined ? null : events.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
            <CalendarDays className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold">No events yet</h2>
          <p className="max-w-sm text-sm text-slate-500">
            Create your first event session. Everything is stored on this device and works offline.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus /> Create new event
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const c = counts?.[ev.id] ?? { total: 0, in: 0 };
            const denom = ev.capacity || c.total;
            const pct = denom ? Math.round((c.in / denom) * 100) : 0;
            return (
              <Card key={ev.id} className="flex flex-col transition-shadow hover:shadow-md">
                <Link to={`/event/${ev.id}`} className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{ev.title}</h3>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    {ev.date && (
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" /> {formatDate(ev.date)}
                      </div>
                    )}
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
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>
                        {c.in} / {denom} checked in
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </Link>
                <div className="border-t p-3">
                  <Button asChild variant="secondary" className="w-full">
                    <Link to={`/scan/${ev.id}`}>
                      <ScanLine /> Open scanner
                    </Link>
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
