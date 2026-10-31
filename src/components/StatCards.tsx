import { CheckCircle2, Clock, UserPlus, Users } from "lucide-react";
import type { Attendee } from "@/lib/db";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";

export function computeStats(attendees: Attendee[]) {
  const total = attendees.length;
  const checkedIn = attendees.filter((a) => a.checkedIn).length;
  const walkIns = attendees.filter((a) => a.walkIn).length;
  return { total, checkedIn, pending: total - checkedIn, walkIns };
}

export function StatCards({ attendees, capacity }: { attendees: Attendee[]; capacity?: number | null }) {
  const s = computeStats(attendees);
  const denom = capacity && capacity > 0 ? capacity : s.total;
  const pct = denom ? Math.round((s.checkedIn / denom) * 100) : 0;

  const items = [
    { label: "Total Guests", value: s.total, icon: Users, tone: "text-slate-700 bg-slate-100" },
    { label: "Checked In", value: s.checkedIn, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pending", value: s.pending, icon: Clock, tone: "text-amber-700 bg-amber-50" },
    { label: "Walk-ins", value: s.walkIns, icon: UserPlus, tone: "text-indigo-700 bg-indigo-50" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-slate-700">
            {capacity && capacity > 0 ? "Capacity reached" : "Attendance"}
          </span>
          <span className="tabular-nums text-slate-600">
            <span className="text-lg font-bold text-slate-900">{pct}%</span> · {s.checkedIn} / {denom || 0}
          </span>
        </div>
        <Progress
          value={pct}
          indicatorClassName={pct >= 100 ? "bg-rose-500" : pct >= 90 ? "bg-amber-500" : "bg-indigo-600"}
        />
      </Card>
    </div>
  );
}
