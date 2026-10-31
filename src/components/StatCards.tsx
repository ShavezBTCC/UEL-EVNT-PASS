import { CheckCircle2, Clock, UserPlus, Users } from "lucide-react";
import type { Attendee } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function StatCards({ attendees, capacity }: { attendees: Attendee[]; capacity?: number }) {
  const total = attendees.length;
  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  const walkIns = attendees.filter((a) => a.walkIn).length;
  const pct = total ? Math.round((checkedIn / total) * 100) : 0;

  const stats = [
    { label: "Total", value: total, icon: Users, tone: "text-slate-700 bg-slate-100" },
    { label: "Checked in", value: checkedIn, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
    { label: "Pending", value: total - checkedIn, icon: Clock, tone: "text-amber-700 bg-amber-100" },
    { label: "Walk-ins", value: walkIns, icon: UserPlus, tone: "text-indigo-700 bg-indigo-100" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-bold tabular-nums leading-none">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Attendance</span>
          <span className="tabular-nums text-muted-foreground">
            {checkedIn} / {total} · {pct}%
            {capacity ? ` · capacity ${capacity}` : ""}
          </span>
        </div>
        <Progress value={pct} indicatorClassName="bg-emerald-500" />
        {capacity && checkedIn > capacity ? (
          <p className="mt-2 text-xs font-medium text-red-600">Over capacity by {checkedIn - capacity}.</p>
        ) : null}
      </Card>
    </div>
  );
}
