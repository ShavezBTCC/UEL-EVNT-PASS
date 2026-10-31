import { useState } from "react";
import { UserPlus } from "lucide-react";
import { addWalkIn } from "@/lib/importers";
import type { Attendee } from "@/lib/db";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function WalkInDialog({
  eventId,
  trigger,
  defaultCheckIn = true,
  initialName = "",
  onAdded,
}: {
  eventId: string;
  trigger?: (open: () => void) => React.ReactNode;
  defaultCheckIn?: boolean;
  initialName?: string;
  onAdded?: (a: Attendee) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [busy, setBusy] = useState(false);

  const show = () => {
    setFullName(initialName);
    setEmail("");
    setTicketId("");
    setCheckIn(defaultCheckIn);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      const a = await addWalkIn(eventId, { fullName, email, ticketId }, checkIn);
      setOpen(false);
      onAdded?.(a);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {trigger ? (
        trigger(show)
      ) : (
        <Button variant="outline" onClick={show}>
          <UserPlus /> Add walk-in
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Add walk-in attendee</DialogTitle>
              <DialogDescription>For guests who aren't on the imported list.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="wi-name">Full name *</Label>
              <Input id="wi-name" autoFocus required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wi-email">Email</Label>
                <Input id="wi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wi-id">Student / Ticket ID</Label>
                <Input id="wi-id" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Auto" />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-indigo-600"
                checked={checkIn}
                onChange={(e) => setCheckIn(e.target.checked)}
              />
              Check them in now
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !fullName.trim()}>
                <UserPlus /> {checkIn ? "Add & check in" : "Add attendee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
