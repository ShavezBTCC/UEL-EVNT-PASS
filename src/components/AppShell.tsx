import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { QrCode, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

export function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const online = useOnline();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <QrCode className="h-5 w-5" />
            </span>
            <span>
              UEL <span className="text-primary">EVNT</span> PASS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {actions}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
              title={online ? "Online" : "Offline – everything still works and is saved on this device"}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
