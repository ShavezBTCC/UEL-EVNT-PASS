import { useState, type FormEvent } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWalkIn } from "@/lib/importers";

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCheckIn?: boolean;
  onAdded?: () => void;
}

export function WalkInDialog({ eventId, open, onOpenChange, defaultCheckIn = false, onAdded }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [checkInNow, setCheckInNow] = useState(defaultCheckIn);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setTicketId("");
    setCheckInNow(defaultCheckIn);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      await addWalkIn(eventId, { fullName, email, ticketId, checkInNow });
      reset();
      onOpenChange(false);
      onAdded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" /> Add walk-in attendee
            </DialogTitle>
            <DialogDescription>A QR pass is generated automatically for this person.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wi-name">Full name *</Label>
            <Input id="wi-name" autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-email">Email</Label>
            <Input id="wi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@university.edu" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-id">Student / Ticket ID</Label>
            <Input id="wi-id" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Leave blank to auto-generate" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={checkInNow} onChange={(e) => setCheckInNow(e.target.checked)} />
            <span className="font-medium text-slate-700">Check them in right now</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!fullName.trim() || busy}>
              {busy && <Loader2 className="animate-spin" />}
              {checkInNow ? "Add & check in" : "Add attendee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
