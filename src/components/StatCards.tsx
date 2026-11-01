import { Users, UserCheck, Clock, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Attendee, EventSession } from "@/lib/db";

export function computeStats(attendees: Attendee[]) {
  const total = attendees.length;
  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  const walkIns = attendees.filter((a) => a.isWalkIn).length;
  return { total, checkedIn, pending: total - checkedIn, walkIns };
}

export function StatCards({ attendees, event }: { attendees: Attendee[]; event: EventSession }) {
  const s = computeStats(attendees);
  const denominator = event.capacity && event.capacity > 0 ? event.capacity : s.total;
  const pct = denominator ? Math.round((s.checkedIn / denominator) * 100) : 0;

  const items = [
    { label: "Total Guests", value: s.total, icon: Users, color: "text-slate-700 bg-slate-100" },
    { label: "Checked In", value: s.checkedIn, icon: UserCheck, color: "text-emerald-700 bg-emerald-100" },
    { label: "Pending", value: s.pending, icon: Clock, color: "text-amber-700 bg-amber-100" },
    { label: "Walk-ins", value: s.walkIns, icon: UserPlus, color: "text-indigo-700 bg-indigo-100" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
              <div className="truncate text-xs font-medium text-slate-500">{label}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">
            {event.capacity ? "Capacity reached" : "Attendance progress"}
          </span>
          <span className="font-bold tabular-nums text-indigo-700">
            {pct}% <span className="font-normal text-slate-500">({s.checkedIn}/{denominator})</span>
          </span>
        </div>
        <Progress value={pct} indicatorClassName={pct >= 100 ? "bg-emerald-500" : undefined} />
      </Card>
    </div>
  );
}
