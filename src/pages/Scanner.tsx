import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ArrowLeft, Camera, CameraOff, Loader2, Search, SwitchCamera, UserCheck, UserPlus } from "lucide-react";
import { checkInAttendee, checkInByQr, db, type CheckInResult } from "@/lib/db";
import { playError, playSuccess, playWarning, unlockAudio } from "@/lib/audio";
import { formatTime } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { ScanResultOverlay } from "@/components/ScanResultOverlay";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(id).toArray(), [id]) ?? [];

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const busyRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [query, setQuery] = useState("");

  const showResult = useCallback((r: CheckInResult) => {
    feedback(r);
    setResult(r);
  }, []);

  const onDecode = useCallback(
    async (text: string) => {
      // Pause while a verdict is on screen, and ignore the same code for a few seconds.
      if (busyRef.current) return;
      const now = Date.now();
      if (text === lastScan.current.text && now - lastScan.current.at < DEBOUNCE_MS) return;
      lastScan.current = { text, at: now };
      busyRef.current = true;
      showResult(await checkInByQr(id, text));
    },
    [id, showResult],
  );

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setRunning(false);
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user") => {
      unlockAudio();
      setCameraError("");
      setStarting(true);
      await stop();
      try {
        const s = new Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = s;
        await s.start(
          { facingMode: mode },
          {
            fps: 12,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.7);
              return { width: size, height: size };
            },
          },
          (text) => void onDecode(text),
          () => {},
        );
        setRunning(true);
      } catch (err) {
        scannerRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setCameraError(
          /permission|notallowed/i.test(msg)
            ? "Camera permission was denied. Allow camera access in your browser settings and try again."
            : window.isSecureContext
              ? `Couldn't start the camera: ${msg}`
              : "The camera needs HTTPS. Open this page over https:// (or localhost).",
        );
      } finally {
        setStarting(false);
      }
    },
    [onDecode, stop],
  );

  useEffect(() => () => void stop(), [stop]);

  const dismiss = useCallback(() => {
    setResult(null);
    busyRef.current = false;
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return attendees
      .filter((a) => a.name.toLowerCase().includes(q) || a.email.includes(q) || a.studentId.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [attendees, query]);

  if (event === null) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!event) {
    return (
      <AppShell>
        <Card className="p-10 text-center">
          <p className="mb-2 font-medium">This event isn't on this device.</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Guest lists are stored locally. Import the same attendee sheet on this device to scan here.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to events</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  const pct = attendees.length ? (checkedIn / attendees.length) * 100 : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={`/event/${event.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-sm font-medium tabular-nums">
            {checkedIn} / {attendees.length} in
          </span>
        </div>
        <div>
          <h1 className="truncate text-xl font-bold">{event.title}</h1>
          <Progress value={pct} className="mt-2" indicatorClassName="bg-emerald-500" />
        </div>

        <Card className="overflow-hidden">
          <div className="relative aspect-square w-full bg-slate-900">
            <div id={READER_ID} className="absolute inset-0" />
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-slate-200">
                {starting ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-12 w-12 opacity-60" />
                    {cameraError ? (
                      <p className="text-sm text-red-300">{cameraError}</p>
                    ) : (
                      <p className="text-sm opacity-80">Point the camera at an attendee's QR pass.</p>
                    )}
                    <Button size="lg" onClick={() => start(facing)}>
                      <Camera /> Start camera
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          {running && (
            <div className="flex gap-2 p-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const next = facing === "environment" ? "user" : "environment";
                  setFacing(next);
                  void start(next);
                }}
              >
                <SwitchCamera /> Flip
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => void stop()}>
                <CameraOff /> Stop
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Manual check-in</h2>
            <WalkInDialog
              eventId={event.id}
              onAdded={async (a) => showResult(await checkInAttendee(a.id))}
              trigger={
                <Button variant="outline" size="sm">
                  <UserPlus /> Walk-in
                </Button>
              }
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name, email or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9 text-base"
            />
          </div>
          {matches.length > 0 && (
            <ul className="mt-3 divide-y rounded-lg border">
              {matches.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.studentId}
                      {a.email ? ` · ${a.email}` : ""}
                    </div>
                  </div>
                  {a.status === "checked_in" ? (
                    <Badge variant="success" className="shrink-0">
                      ✓ {formatTime(a.checkedInAt)}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={async () => {
                        unlockAudio();
                        busyRef.current = true;
                        showResult(await checkInAttendee(a.id));
                        setQuery("");
                      }}
                    >
                      <UserCheck /> Check in
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && matches.length === 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">No matches — add them as a walk-in.</p>
          )}
        </Card>
      </div>

      <ScanResultOverlay result={result} onDismiss={dismiss} />
    </AppShell>
  );
}
