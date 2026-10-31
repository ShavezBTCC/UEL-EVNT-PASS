import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  FileArchive,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MapPin,
  ScanLine,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { checkInAttendee, db, deleteEvent } from "@/lib/db";
import { importAttendees, parseSheet, type ParsedSheet } from "@/lib/importers";
import { downloadPassesPdf, downloadPassesZip, exportAttendanceReport } from "@/lib/exporters";
import { formatDate } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { AttendeeTable } from "@/components/AttendeeTable";
import { ColumnMapper } from "@/components/ColumnMapper";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCards } from "@/components/StatCards";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function EventDashboard() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const event = useLiveQuery(() => db.events.get(id), [id], null);
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(id).toArray(), [id]) ?? [];

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [job, setJob] = useState<{ label: string; done: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

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
          <p className="mb-4 text-muted-foreground">This event doesn't exist on this device.</p>
          <Button asChild variant="outline">
            <Link to="/">Back to events</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const handleFile = async (file: File) => {
    setNotice(null);
    try {
      const parsed = await parseSheet(file);
      if (parsed.rows.length === 0) throw new Error("The sheet has a header row but no data rows.");
      setFileName(file.name);
      setSheet(parsed);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Couldn't read that file." });
    }
  };

  const runPassJob = async (label: string, fn: typeof downloadPassesPdf) => {
    if (attendees.length === 0) return;
    const sorted = [...attendees].sort((a, b) => a.name.localeCompare(b.name));
    setJob({ label, done: 0, total: sorted.length });
    try {
      await fn(event, sorted, (done, total) => setJob({ label, done, total }));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Download failed." });
    } finally {
      setJob(null);
    }
  };

  const scanUrl = `${window.location.origin}/scan/${event.id}`;
  const noAttendees = attendees.length === 0;

  return (
    <AppShell
      actions={
        <Button asChild size="sm">
          <Link to={`/scan/${event.id}`}>
            <ScanLine /> Scan
          </Link>
        </Button>
      }
    >
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {formatDate(event.date)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {event.location}
              </span>
            )}
            {event.organizer && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" /> {event.organizer}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={async () => {
            if (!confirm(`Delete "${event.title}" and all ${attendees.length} attendees? This can't be undone.`)) return;
            await deleteEvent(event.id);
            navigate("/");
          }}
        >
          <Trash2 /> Delete event
        </Button>
      </div>

      <StatCards attendees={attendees} capacity={event.capacity} />

      {notice && (
        <div
          className={
            notice.tone === "ok"
              ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {notice.text}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Import attendees</CardTitle>
            <CardDescription>Each attendee gets a unique QR pass.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone onFile={handleFile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Download passes</CardTitle>
            <CardDescription>Print, email or mail-merge the QR codes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={noAttendees || !!job}
              onClick={() => runPassJob("Building PDF", downloadPassesPdf)}
            >
              <FileDown /> PDF – 6 per A4 page
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={noAttendees || !!job}
              onClick={() => runPassJob("Building ZIP", downloadPassesZip)}
            >
              <FileArchive /> ZIP of PNGs + index.csv
            </Button>
            {job && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{job.label}…</span>
                  <span className="tabular-nums">
                    {job.done}/{job.total}
                  </span>
                </div>
                <Progress value={job.total ? (job.done / job.total) * 100 : 0} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · At the door</CardTitle>
            <CardDescription>Share the scanner link with door staff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link to={`/scan/${event.id}`}>
                <ScanLine /> Open scanner
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={async () => {
                await navigator.clipboard?.writeText(scanUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Link copied" : "Copy scanner link"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={noAttendees}
              onClick={() => exportAttendanceReport(event, attendees)}
            >
              <FileSpreadsheet /> Export attendance report (.xlsx)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Attendees</h2>
          <WalkInDialog
            eventId={event.id}
            onAdded={async (a) => {
              await checkInAttendee(a.id);
            }}
            trigger={
              <Button variant="outline" size="sm">
                <UserPlus /> Walk-in
              </Button>
            }
          />
        </div>
        <AttendeeTable attendees={attendees} eventId={event.id} />
      </div>

      <ColumnMapper
        sheet={sheet}
        fileName={fileName}
        onCancel={() => setSheet(null)}
        onConfirm={async (mapping) => {
          if (!sheet) return;
          try {
            const r = await importAttendees(event.id, sheet, mapping);
            const skipped = [
              r.skippedDuplicates ? `${r.skippedDuplicates} duplicates` : "",
              r.skippedEmpty ? `${r.skippedEmpty} rows without a name` : "",
            ].filter(Boolean);
            setNotice({
              tone: "ok",
              text: `Imported ${r.added} attendees${skipped.length ? ` · skipped ${skipped.join(", ")}` : ""}.`,
            });
          } catch (err) {
            setNotice({ tone: "error", text: err instanceof Error ? err.message : "Import failed." });
          }
          setSheet(null);
        }}
      />
    </AppShell>
  );
}
