import { Link } from "react-router-dom";
import { QrCode, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

export function OnlinePill({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        online ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
        className,
      )}
      title={online ? "Online" : "Offline — check-ins are saved on this device"}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? "Online" : "Offline"}
    </span>
  );
}

export function AppShell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <QrCode className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">UEL EVNT PASS</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <OnlinePill />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
