import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, Search, SwitchCamera, UserCheck, UserPlus } from "lucide-react";
import { OnlinePill } from "@/components/AppShell";
import { ScanResultOverlay } from "@/components/ScanResultOverlay";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { checkInAttendee, checkInByQr, computeStats, db, getEventAttendees, type CheckInResult } from "@/lib/db";
import { playError, playSuccess, playWarning, unlockAudio } from "@/lib/audio";
import { formatTime } from "@/lib/utils";

const READER_ID = "qr-reader";
const DEBOUNCE_MS = 3000;

function feedback(result: CheckInResult) {
  if (result.kind === "success") playSuccess();
  else if (result.kind === "duplicate") playWarning();
  else playError();
}

export default function Scanner() {
  const { id = "" } = useParams();
  const event = useLiveQuery(() => db.events.get(id), [id], null);
  const attendees = useLiveQuery(() => getEventAttendees(id), [id], []);
  const stats = computeStats(attendees);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const showingRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [query, setQuery] = useState("");

  const show = useCallback((r: CheckInResult) => {
    feedback(r);
    showingRef.current = true;
    setResult(r);
    const s = scannerRef.current;
    if (s?.getState() === Html5QrcodeScannerState.SCANNING) s.pause(true);
  }, []);

  const dismiss = useCallback(() => {
    showingRef.current = false;
    setResult(null);
    const s = scannerRef.current;
    if (s?.getState() === Html5QrcodeScannerState.PAUSED) s.resume();
  }, []);

  const onDecoded = useCallback(
    async (text: string) => {
      if (busyRef.current || showingRef.current) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.text === text && now - last.at < DEBOUNCE_MS) return;
      lastScanRef.current = { text, at: now };
      busyRef.current = true;
      try {
        show(await checkInByQr(id, text));
      } finally {
        busyRef.current = false;
      }
    },
    [id, show],
  );

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setRunning(false);
    if (!s) return;
    try {
      if (s.getState() !== Html5QrcodeScannerState.NOT_STARTED) await s.stop();
      s.clear();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user" = facing) => {
      unlockAudio();
      setCameraError(null);
      setStarting(true);
      await stop();
      try {
        const s = new Html5Qrcode(READER_ID, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        scannerRef.current = s;
        await s.start(
          { facingMode: mode },
          {
            fps: 12,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.7);
              return { width: size, height: size };
            },
            aspectRatio: 1,
          },
          (text) => void onDecoded(text),
          undefined,
        );
        setRunning(true);
      } catch (err) {
        scannerRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(
          /permission|notallowed/i.test(msg)
            ? "Camera permission was denied. Allow camera access in your browser settings and try again."
            : !window.isSecureContext
              ? "The camera needs HTTPS. Open this page over https:// (or localhost)."
              : `Couldn't start the camera: ${msg}`,
        );
      } finally {
        setStarting(false);
      }
    },
    [facing, onDecoded, stop],
  );

  useEffect(() => () => void stop(), [stop]);

  const flip = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (running) void start(next);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return attendees
      .filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q))
      .slice(0, 8);
  }, [attendees, query]);

  if (event === null) return <div className="min-h-dvh bg-slate-950" />;
  if (event === undefined) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white">
        <h1 className="text-lg font-semibold">Event not found on this device</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Guest lists are stored locally. Import the attendee sheet for this event on this device first.
        </p>
        <Button asChild variant="secondary">
          <Link to="/">Go to events</Link>
        </Button>
      </div>
    );
  }

  const pct = stats.total ? (stats.checkedIn / stats.total) * 100 : 0;

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Link to={`/event/${event.id}`} className="rounded-md p-1 text-slate-300 hover:text-white" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{event.title}</div>
            <div className="text-xs tabular-nums text-slate-400">
              {stats.checkedIn} / {stats.total} checked in
            </div>
          </div>
          <OnlinePill />
        </div>
        <Progress value={pct} className="h-1 rounded-none bg-white/10" indicatorClassName="bg-emerald-400" />
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-5">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          <div id={READER_ID} className="h-full w-full" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                {cameraError ? <CameraOff className="h-8 w-8 text-red-400" /> : <Camera className="h-8 w-8 text-indigo-300" />}
              </span>
              {cameraError ? (
                <p className="max-w-xs text-sm text-red-300">{cameraError}</p>
              ) : (
                <p className="max-w-xs text-sm text-slate-300">Point the camera at a pass. Results appear full-screen with sound.</p>
              )}
              <Button size="lg" onClick={() => void start()} disabled={starting}>
                <Camera /> {starting ? "Starting…" : "Start camera"}
              </Button>
            </div>
          )}
        </div>

        {running && (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={flip}>
              <SwitchCamera /> Flip camera
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void stop()}>
              <CameraOff /> Stop
            </Button>
          </div>
        )}

        <section className="space-y-3 rounded-2xl bg-white p-4 text-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Manual check-in</h2>
            <WalkInDialog
              eventId={event.id}
              initialName={matches.length === 0 ? query.trim() : ""}
              onAdded={(a) => {
                setQuery("");
                show({ kind: "success", attendee: a });
              }}
              trigger={(open) => (
                <Button size="sm" variant="outline" onClick={open}>
                  <UserPlus /> Walk-in
                </Button>
              )}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="h-12 pl-9 text-base" placeholder="Search name, email or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {query.trim().length >= 2 && (
            <ul className="divide-y rounded-lg border">
              {matches.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.externalId}
                      {a.email ? ` · ${a.email}` : ""}
                    </div>
                  </div>
                  {a.status === "checked_in" ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> {formatTime(a.checkedInAt)}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        unlockAudio();
                        show(await checkInAttendee(a.id));
                        setQuery("");
                      }}
                    >
                      <UserCheck /> Check in
                    </Button>
                  )}
                </li>
              ))}
              {matches.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No one matches — add them as a walk-in.</li>}
            </ul>
          )}
        </section>
      </main>

      <ScanResultOverlay result={result} onDismiss={dismiss} />
    </div>
  );
}
