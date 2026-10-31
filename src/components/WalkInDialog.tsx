import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { addWalkIn } from "@/lib/importers";
import type { Attendee } from "@/lib/db";
import { Button } from "@/components/ui/button";
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

interface Props {
  eventId: string;
  trigger: ReactNode;
  /** Called after the walk-in is saved (e.g. to check them in). */
  onAdded?: (attendee: Attendee) => void | Promise<void>;
}

export function WalkInDialog({ eventId, trigger, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setStudentId("");
    setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError("");
    try {
      const attendee = await addWalkIn(eventId, { name, email, studentId });
      await onAdded?.(attendee);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add walk-in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add walk-in</DialogTitle>
          <DialogDescription>Register an unregistered guest and check them in straight away.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wi-name">Full name *</Label>
            <Input id="wi-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-email">Email</Label>
            <Input id="wi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-id">Student / Ticket ID</Label>
            <Input
              id="wi-id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Leave blank to generate"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Add &amp; check in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
