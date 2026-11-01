import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { QrCode, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

export function OnlinePill({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800",
        className,
      )}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? "Online" : "Offline"}
    </span>
  );
}

export function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <QrCode className="h-4 w-4" />
            </span>
            <span>
              UEL <span className="text-indigo-600">EVNT</span> PASS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {actions}
            <OnlinePill />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
