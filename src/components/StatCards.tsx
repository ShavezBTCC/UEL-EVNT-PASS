import { Clock, UserCheck, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EventStats } from "@/lib/db";

export function StatCards({ stats, capacity }: { stats: EventStats; capacity?: number }) {
  const pct = stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
  const items = [
    { label: "Total", value: stats.total, icon: Users, tone: "bg-slate-100 text-slate-700" },
    { label: "Checked In", value: stats.checkedIn, icon: UserCheck, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Pending", value: stats.pending, icon: Clock, tone: "bg-amber-100 text-amber-700" },
    { label: "Walk-ins", value: stats.walkIns, icon: UserPlus, tone: "bg-indigo-100 text-indigo-700" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Attendance</span>
          <span className="tabular-nums text-muted-foreground">
            {stats.checkedIn} / {stats.total} · {pct}%
            {capacity ? ` · capacity ${capacity}` : ""}
          </span>
        </div>
        <Progress value={pct} indicatorClassName="bg-emerald-500" />
        {capacity && stats.checkedIn >= capacity ? (
          <p className="mt-2 text-xs font-medium text-red-600">Capacity reached.</p>
        ) : null}
      </Card>
    </div>
  );
}
