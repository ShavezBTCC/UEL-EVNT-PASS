import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { QrCode, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const online = useOnline();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <QrCode className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">UEL EVNT PASS</span>
            <span className="sm:hidden">UEL</span>
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <span
              title={online ? "Online" : "Offline — check-ins are saved locally"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
                online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
