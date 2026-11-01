import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, ChevronRight, MapPin, Plus, ScanLine, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createEvent, db, type NewEvent } from "@/lib/db";
import { formatDate } from "@/lib/utils";

const EMPTY = { title: "", date: "", location: "", organizer: "", capacity: "" };

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const capacity = parseInt(form.capacity, 10);
      const input: NewEvent = {
        title: form.title.trim(),
        date: form.date,
        location: form.location.trim(),
        organizer: form.organizer.trim(),
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
      };
      const event = await createEvent(input);
      setForm(EMPTY);
      onOpenChange(false);
      navigate(`/event/${event.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>You can import attendees right after.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title *</Label>
            <Input id="ev-title" required autoFocus placeholder="Freshers' Welcome Night" value={form.title} onChange={set("title")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date *</Label>
              <Input id="ev-date" type="date" required value={form.date} onChange={set("date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cap">Capacity</Label>
              <Input id="ev-cap" type="number" min={1} placeholder="Optional" value={form.capacity} onChange={set("capacity")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" placeholder="Docklands Campus, EB.G.01" value={form.location} onChange={set("location")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-org">Organizer</Label>
            <Input id="ev-org" placeholder="Students' Union" value={form.organizer} onChange={set("organizer")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.title.trim() || !form.date}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [creating, setCreating] = useState(false);

  const events = useLiveQuery(async () => {
    const list = await db.events.orderBy("createdAt").reverse().toArray();
    return Promise.all(
      list.map(async (event) => {
        const total = await db.attendees.where("eventId").equals(event.id).count();
        const checkedIn = await db.attendees.where("[eventId+status]").equals([event.id, "checked_in"]).count();
        return { event, total, checkedIn };
      }),
    );
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Events</h1>
          <p className="text-sm text-muted-foreground">Create an event, import attendees, hand out QR passes and scan them at the door.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New event
        </Button>
      </div>

      {events === undefined ? null : events.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <CalendarDays className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold">No events yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Everything is stored on this device, so it works offline at the door. Start by creating your first event.
          </p>
          <Button onClick={() => setCreating(true)} className="mt-2">
            <Plus /> Create event
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(({ event, total, checkedIn }) => {
            const pct = total ? Math.round((checkedIn / total) * 100) : 0;
            return (
              <Card key={event.id} className="flex flex-col transition hover:shadow-md">
                <Link to={`/event/${event.id}`} className="flex-1 space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{event.title}</h2>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> {formatDate(event.date)}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {event.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> {checkedIn} / {total} checked in
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" indicatorClassName="bg-emerald-500" />
                </Link>
                <div className="border-t p-3">
                  <Button asChild variant="secondary" className="w-full">
                    <Link to={`/scan/${event.id}`}>
                      <ScanLine /> Scan
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateEventDialog open={creating} onOpenChange={setCreating} />
    </AppShell>
  );
}
