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
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AttendeeTable } from "@/components/AttendeeTable";
import { ColumnMapper } from "@/components/ColumnMapper";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCards } from "@/components/StatCards";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db, deleteEvent } from "@/lib/db";
import { exportAttendanceReport, exportPassesPdf, exportPassesZip } from "@/lib/exporters";
import { importAttendees, parseSpreadsheet, type ColumnMapping, type ParsedSheet } from "@/lib/importers";
import { formatDate } from "@/lib/utils";

export default function EventDashboard() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const event = useLiveQuery(() => db.events.get(id), [id], null);
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(id).toArray(), [id]) ?? [];

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapperOpen, setMapperOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [exporting, setExporting] = useState<{ kind: "pdf" | "zip"; done: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (event === null) return null; // loading
  if (!event) {
    return (
      <AppShell>
        <Card className="p-10 text-center">
          <h1 className="text-lg font-semibold">Event not found on this device</h1>
          <p className="mt-1 text-sm text-slate-500">Events are stored locally in the browser that created them.</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to events</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const onFile = async (file: File) => {
    setNotice(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.rows.length === 0) {
        setNotice({ tone: "err", text: "That sheet looks empty — make sure the first row has column headers." });
        return;
      }
      setFileName(file.name);
      setSheet(parsed);
      setMapperOpen(true);
    } catch (err) {
      console.error(err);
      setNotice({ tone: "err", text: "Couldn't read that file. Is it a valid .xlsx or .csv?" });
    }
  };

  const onConfirm = async (mapping: ColumnMapping) => {
    if (!sheet) return;
    const r = await importAttendees(event.id, sheet, mapping);
    setMapperOpen(false);
    const skipped = [
      r.skippedDuplicate && `${r.skippedDuplicate} duplicates`,
      r.skippedNoName && `${r.skippedNoName} without a name`,
    ].filter(Boolean);
    setNotice({
      tone: "ok",
      text: `Imported ${r.added} attendees${skipped.length ? ` · skipped ${skipped.join(", ")}` : ""}.`,
    });
  };

  const runExport = async (kind: "pdf" | "zip") => {
    if (attendees.length === 0) return;
    const sorted = [...attendees].sort((a, b) => a.fullName.localeCompare(b.fullName));
    setExporting({ kind, done: 0, total: sorted.length });
    try {
      const fn = kind === "pdf" ? exportPassesPdf : exportPassesZip;
      await fn(event, sorted, (done, total) => setExporting({ kind, done, total }));
    } finally {
      setExporting(null);
    }
  };

  const scanUrl = `${window.location.origin}/scan/${event.id}`;

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
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {event.date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-slate-400" /> {formatDate(event.date)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" /> {event.location}
              </span>
            )}
            {event.organizer && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" /> {event.organizer}
              </span>
            )}
          </div>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={`/scan/${event.id}`}>
            <ScanLine /> Open scanner
          </Link>
        </Button>
      </div>

      <StatCards attendees={attendees} capacity={event.capacity} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="order-2 space-y-3 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Attendees</h2>
            <WalkInDialog eventId={event.id} defaultCheckIn={false} />
          </div>
          <AttendeeTable event={event} attendees={attendees} />
        </section>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import attendees</CardTitle>
              <CardDescription>Each attendee gets a unique QR pass.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FileDropzone onFile={onFile} />
              {notice && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
                >
                  {notice.text}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Download QR passes</CardTitle>
              <CardDescription>PDF has 6 passes per A4 page. ZIP has PNGs + index.csv.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" disabled={!attendees.length || !!exporting} onClick={() => runExport("pdf")}>
                {exporting?.kind === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
                {exporting?.kind === "pdf" ? `Generating ${exporting.done}/${exporting.total}` : "All passes (PDF)"}
              </Button>
              <Button variant="outline" disabled={!attendees.length || !!exporting} onClick={() => runExport("zip")}>
                {exporting?.kind === "zip" ? <Loader2 className="animate-spin" /> : <FileArchive />}
                {exporting?.kind === "zip" ? `Generating ${exporting.done}/${exporting.total}` : "All passes (ZIP)"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report & sharing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button disabled={!attendees.length} onClick={() => exportAttendanceReport(event, attendees)}>
                <FileSpreadsheet /> Export attendance report (.xlsx)
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(scanUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    prompt("Scanner link", scanUrl);
                  }
                }}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy scanner link"}
              </Button>
              <p className="text-xs text-slate-500">
                The guest list lives on this device. Other door-staff devices need the same sheet imported.
              </p>
              <Button
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={async () => {
                  if (confirm(`Delete "${event.title}" and all ${attendees.length} attendees? This can't be undone.`)) {
                    await deleteEvent(event.id);
                    navigate("/");
                  }
                }}
              >
                <Trash2 /> Delete event
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ColumnMapper
        sheet={sheet}
        fileName={fileName}
        open={mapperOpen}
        onOpenChange={setMapperOpen}
        onConfirm={onConfirm}
      />
    </AppShell>
  );
}
