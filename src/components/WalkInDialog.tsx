import { useState, type FormEvent, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWalkIn } from "@/lib/importers";
import type { Attendee } from "@/lib/db";

interface Props {
  eventId: string;
  initialName?: string;
  onAdded?: (attendee: Attendee) => void;
  trigger?: (open: () => void) => ReactNode;
}

export function WalkInDialog({ eventId, initialName = "", onAdded, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);

  const show = () => {
    setName(initialName);
    setEmail("");
    setExternalId("");
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const attendee = await addWalkIn(eventId, { name, email, externalId });
      onAdded?.(attendee);
      setOpen(false);
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
          <UserPlus /> Walk-in
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add walk-in</DialogTitle>
            <DialogDescription>Adds an unregistered guest and checks them in immediately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Full name *</Label>
              <Input id="walkin-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-email">Email</Label>
              <Input id="walkin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-id">Student / Ticket ID</Label>
              <Input id="walkin-id" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                Add & check in
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
