import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera, CameraOff, Search, UserCheck, UserPlus, SwitchCamera, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanResultOverlay } from "@/components/ScanResultOverlay";
import { WalkInDialog } from "@/components/WalkInDialog";
import { checkInAttendee, checkInByToken, db, type Attendee, type CheckInResult } from "@/lib/db";
import { playError, playSuccess, playWarning, unlockAudio, vibrate } from "@/lib/audio";
import { useOnline } from "@/hooks/useOnline";
import { formatTime } from "@/lib/utils";
import { computeStats } from "@/components/StatCards";

const READER_ID = "qr-reader";

export default function Scanner() {
  const { eventId = "" } = useParams();
  const online = useOnline();
  // undefined = loading, null = not found
  const event = useLiveQuery(() => db.events.get(eventId).then((e) => e ?? null), [eventId]);
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(eventId).toArray(), [eventId]);
  const pendingSync = useLiveQuery(() => db.outbox.where("synced").equals(0).count(), []);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [query, setQuery] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const stats = useMemo(() => computeStats(attendees ?? []), [attendees]);

  // ---- scanning ---------------------------------------------------------

  const handleResult = useCallback((r: CheckInResult) => {
    setResult(r);
    if (r.kind === "success") {
      playSuccess();
      vibrate(80);
    } else if (r.kind === "duplicate") {
      playWarning();
      vibrate([80, 60, 80]);
    } else {
      playError();
      vibrate([150, 80, 150]);
    }
  }, []);

  const onDecoded = useCallback(
    async (text: string) => {
      // Debounce: the camera fires the same code many times per second.
      const now = Date.now();
      if (busyRef.current) return;
      if (lastRef.current.text === text && now - lastRef.current.at < 3000) return;
      lastRef.current = { text, at: now };
      busyRef.current = true;
      try {
        handleResult(await checkInByToken(eventId, text));
      } finally {
        busyRef.current = false;
      }
    },
    [eventId, handleResult],
  );

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* ignore */
      }
    }
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    unlockAudio();
    setCameraError(null);
    await stopCamera();
    try {
      const s = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: facing },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }), aspectRatio: 1 },
        onDecoded,
        () => {}, // per-frame decode failures are normal; ignore
      );
      setCameraOn(true);
    } catch (e) {
      scannerRef.current = null;
      setCameraOn(false);
      const msg = e instanceof Error ? e.message : String(e);
      setCameraError(
        /NotAllowed|Permission/i.test(msg)
          ? "Camera permission denied. Allow camera access in your browser settings and try again."
          : /NotFound|no camera/i.test(msg)
            ? "No camera found on this device. Use the manual search below."
            : `Could not start camera: ${msg}`,
      );
    }
  }, [facing, onDecoded, stopCamera]);

  // Pause scanning while a result is on screen, resume when dismissed.
  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !cameraOn) return;
    try {
      if (result) s.pause(true);
      else s.resume();
    } catch {
      /* ignore */
    }
  }, [result, cameraOn]);

  useEffect(() => () => void stopCamera(), [stopCamera]);

  const flipCamera = async () => {
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  };
  useEffect(() => {
    if (cameraOn) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // ---- manual search ----------------------------------------------------

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !attendees) return [];
    return attendees
      .filter(
        (a) =>
          a.fullName.toLowerCase().includes(needle) ||
          a.ticketId.toLowerCase().includes(needle) ||
          a.email.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .slice(0, 8);
  }, [attendees, query]);

  const manualCheckIn = async (a: Attendee) => {
    unlockAudio();
    const r = await checkInAttendee(a);
    handleResult(r);
    setQuery("");
  };

  if (event === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">Event not found on this device.</p>
        <p className="text-sm text-slate-500">Guest lists are stored locally — import the sheet on this device first.</p>
        <Button asChild>
          <Link to="/">Go to events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur">
        <Link to={`/event/${eventId}`} className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-slate-300 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold">{event?.title ?? "…"}</div>
          <div className="text-[11px] text-slate-400">
            {stats.checkedIn}/{stats.total} checked in
          </div>
        </div>
        <span
          className={`inline-flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${
            online ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
          }`}
          title={online ? "Online" : "Offline — check-ins are saved on this device"}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {pendingSync ? <span>{pendingSync}</span> : null}
        </span>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-4 p-3 pb-10">
        {/* Camera viewport */}
        <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "1 / 1" }}>
          <div id={READER_ID} className="h-full w-full" />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-indigo-600">
                <Camera className="h-8 w-8" />
              </span>
              <p className="text-sm text-slate-300">Point the camera at an attendee's QR pass.</p>
              {cameraError && <p className="rounded-lg bg-red-500/20 p-3 text-sm text-red-200">{cameraError}</p>}
              <Button size="xl" onClick={startCamera}>
                <Camera /> Start camera
              </Button>
            </div>
          )}
          {cameraOn && (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[75%] w-[75%] rounded-2xl border-4 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                <Button size="icon" variant="outline" className="h-12 w-12 border-white/30 bg-black/50 text-white" onClick={flipCamera} title="Flip camera">
                  <SwitchCamera />
                </Button>
                <Button size="icon" variant="outline" className="h-12 w-12 border-white/30 bg-black/50 text-white" onClick={stopCamera} title="Stop camera">
                  <CameraOff />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Manual search fallback */}
        <section className="rounded-2xl bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Manual check-in</h2>
            <Button size="sm" variant="ghost" className="text-indigo-300 hover:bg-white/10 hover:text-indigo-200" onClick={() => setWalkInOpen(true)}>
              <UserPlus /> Walk-in
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              className="h-14 border-slate-700 bg-slate-800 pl-10 text-lg text-white placeholder:text-slate-500"
              placeholder="Search name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
              autoComplete="off"
            />
          </div>
          {attendees === undefined && (
            <div className="flex justify-center p-4 text-slate-500">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {query.trim() && matches.length === 0 && attendees && (
            <p className="p-4 text-center text-sm text-slate-500">No one matches "{query}".</p>
          )}
          {matches.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-800">
              {matches.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.fullName}</div>
                    <div className="truncate text-xs text-slate-400">
                      {a.ticketId}
                      {a.email ? ` · ${a.email}` : ""}
                    </div>
                  </div>
                  {a.status === "checked_in" ? (
                    <Badge variant="success" className="shrink-0">
                      In · {formatTime(a.checkedInAt)}
                    </Badge>
                  ) : (
                    <Button size="lg" variant="success" className="shrink-0" onClick={() => manualCheckIn(a)}>
                      <UserCheck /> Check in
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!online && (
          <p className="rounded-xl bg-amber-500/15 p-3 text-center text-xs text-amber-200">
            You're offline. Check-ins are saved on this device and will sync when you're back online.
          </p>
        )}
      </main>

      <ScanResultOverlay result={result} onDismiss={() => setResult(null)} />
      <WalkInDialog eventId={eventId} open={walkInOpen} onOpenChange={setWalkInOpen} defaultCheckIn />
    </div>
  );
}
