import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, Search, SwitchCamera, UserPlus } from "lucide-react";
import { OnlinePill } from "@/components/AppShell";
import { matchesQuery } from "@/components/AttendeeTable";
import { ScanResultOverlay } from "@/components/ScanResultOverlay";
import { computeStats } from "@/components/StatCards";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { playDuplicate, playError, playSuccess, unlockAudio } from "@/lib/audio";
import { checkInById, checkInByQr, db, type CheckInResult } from "@/lib/db";
import { formatTime } from "@/lib/utils";

const READER_ID = "qr-reader";
const DEBOUNCE_MS = 3000;

function feedback(r: CheckInResult) {
  if (r.status === "success") playSuccess();
  else if (r.status === "duplicate") playDuplicate();
  else playError();
}

export default function Scanner() {
  const { id = "" } = useParams();
  const event = useLiveQuery(() => db.events.get(id), [id], null);
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(id).toArray(), [id]) ?? [];

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const busyRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [query, setQuery] = useState("");

  const show = useCallback((r: CheckInResult) => {
    feedback(r);
    setResult(r);
    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) s.pause(true);
  }, []);

  const dismiss = useCallback(() => {
    setResult(null);
    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.PAUSED) s.resume();
  }, []);

  const onDecoded = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (busyRef.current) return;
      if (text === lastScan.current.text && now - lastScan.current.at < DEBOUNCE_MS) return;
      lastScan.current = { text, at: now };
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
    if (!s) return;
    try {
      if (s.getState() !== Html5QrcodeScannerState.NOT_STARTED) await s.stop();
      s.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user" = facing) => {
      unlockAudio();
      setCamError(null);
      setStarting(true);
      await stop();
      try {
        const s = new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = s;
        await s.start(
          { facingMode: mode },
          {
            fps: 12,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.72);
              return { width: size, height: size };
            },
            aspectRatio: 1,
          },
          (text) => void onDecoded(text),
          () => {},
        );
        setRunning(true);
      } catch (err) {
        console.error(err);
        scannerRef.current = null;
        const msg = String(err);
        setCamError(
          /NotAllowed|Permission/i.test(msg)
            ? "Camera permission was denied. Allow camera access in your browser settings, then try again."
            : window.isSecureContext
              ? "Couldn't start the camera. Make sure no other app is using it."
              : "Camera needs HTTPS. Open this page over https:// or on localhost.",
        );
      } finally {
        setStarting(false);
      }
    },
    [facing, onDecoded, stop],
  );

  useEffect(() => () => void stop(), [stop]);

  const stats = computeStats(attendees);
  const denom = event?.capacity || stats.total;
  const pct = denom ? Math.round((stats.checkedIn / denom) * 100) : 0;

  const matches = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return attendees
      .filter((a) => matchesQuery(a, q))
      .sort((a, b) => a.checkedIn - b.checkedIn || a.fullName.localeCompare(b.fullName))
      .slice(0, 25);
  }, [attendees, query]);

  if (event === null) return null;
  if (!event) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Event not found on this device</h1>
          <p className="mt-1 text-sm text-slate-500">Import the guest list on this device first.</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white">
            <Link to={`/event/${event.id}`} aria-label="Back to event">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold leading-tight">{event.title}</div>
            <div className="text-xs tabular-nums text-slate-400">
              {stats.checkedIn} / {denom} checked in · {pct}%
            </div>
          </div>
          <OnlinePill />
        </div>
        <Progress value={pct} className="h-1 rounded-none bg-white/10" indicatorClassName="bg-emerald-500" />
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-3 pb-10">
        <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          <div id={READER_ID} className="aspect-square w-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <Camera className="h-14 w-14 text-slate-500" />
              {camError ? (
                <p className="max-w-xs text-sm text-rose-300">{camError}</p>
              ) : (
                <p className="max-w-xs text-sm text-slate-400">Point the camera at an attendee's QR pass.</p>
              )}
              <Button size="xl" onClick={() => start()} disabled={starting} className="bg-indigo-600 hover:bg-indigo-500">
                <Camera /> {starting ? "Starting…" : "Start camera"}
              </Button>
            </div>
          )}
        </div>

        {running && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                const next = facing === "environment" ? "user" : "environment";
                setFacing(next);
                void start(next);
              }}
            >
              <SwitchCamera /> Flip
            </Button>
            <Button size="lg" variant="secondary" onClick={() => void stop()}>
              <CameraOff /> Stop
            </Button>
          </div>
        )}

        <section className="rounded-2xl bg-white p-4 text-slate-900">
          <h2 className="mb-2 font-semibold">Manual check-in</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or ID"
              className="h-12 pl-10 text-base"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {query.trim().length >= 2 && (
            <ul className="mt-3 divide-y overflow-hidden rounded-xl border">
              {matches.length === 0 && <li className="p-4 text-center text-sm text-slate-500">No matches</li>}
              {matches.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={!!a.checkedIn}
                    onClick={async () => {
                      unlockAudio();
                      show(await checkInById(a.id));
                      setQuery("");
                    }}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-indigo-50 disabled:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{a.fullName}</div>
                      <div className="truncate text-xs text-slate-500">
                        {a.ticketId}
                        {a.email && ` · ${a.email}`}
                      </div>
                    </div>
                    {a.checkedIn ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" /> {formatTime(a.checkedInAt)}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Check in</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <WalkInDialog
            eventId={event.id}
            initialName={query.trim()}
            onAdded={(a) => {
              setQuery("");
              if (a.checkedIn) show({ status: "success", attendee: a });
            }}
            trigger={(open) => (
              <Button variant="outline" size="lg" className="mt-3 w-full" onClick={open}>
                <UserPlus /> Walk-in
              </Button>
            )}
          />
        </section>
      </main>

      <ScanResultOverlay result={result} onDismiss={dismiss} />
    </div>
  );
}
