import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, MapPin, Plus, ScanLine, User, Users } from "lucide-react";
import { createEvent, db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

function CreateEventDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", location: "", organizer: "", capacity: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const capacity = parseInt(form.capacity, 10);
    const id = await createEvent({
      title: form.title.trim(),
      date: form.date,
      location: form.location.trim(),
      organizer: form.organizer.trim(),
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
    });
    setOpen(false);
    navigate(`/event/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>You can import attendees right after.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title *</Label>
            <Input id="ev-title" value={form.title} onChange={set("title")} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date *</Label>
              <Input id="ev-date" type="date" value={form.date} onChange={set("date")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cap">Capacity</Label>
              <Input id="ev-cap" type="number" min={1} value={form.capacity} onChange={set("capacity")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={form.location} onChange={set("location")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-org">Organizer</Label>
            <Input id="ev-org" value={form.organizer} onChange={set("organizer")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const events = useLiveQuery(() => db.events.orderBy("createdAt").reverse().toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.attendees.toArray();
    const map: Record<string, { total: number; in: number }> = {};
    for (const a of all) {
      const c = (map[a.eventId] ??= { total: 0, in: 0 });
      c.total++;
      if (a.status === "checked_in") c.in++;
    }
    return map;
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Create an event, import attendees, scan passes at the door.</p>
        </div>
        <CreateEventDialog />
      </div>

      {events && events.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
            <CalendarDays className="h-7 w-7" />
          </span>
          <h2 className="text-lg font-semibold">No events yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Everything is stored on this device and works offline. Create your first event to get started.
          </p>
          <CreateEventDialog />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events?.map((ev) => {
          const c = counts?.[ev.id] ?? { total: 0, in: 0 };
          const pct = c.total ? Math.round((c.in / c.total) * 100) : 0;
          return (
            <Card key={ev.id} className="flex flex-col p-5 transition-shadow hover:shadow-md">
              <Link to={`/event/${ev.id}`} className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold leading-tight">{ev.title}</h2>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> {formatDate(ev.date)}
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> {ev.location}
                    </div>
                  )}
                  {ev.organizer && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" /> {ev.organizer}
                    </div>
                  )}
                </div>
              </Link>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.in} / {c.total} checked in
                  </span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} indicatorClassName="bg-emerald-500" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to={`/event/${ev.id}`}>Manage</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link to={`/scan/${ev.id}`}>
                    <ScanLine /> Scan
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
