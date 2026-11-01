import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  User,
  ScanLine,
  Download,
  FileSpreadsheet,
  UserPlus,
  FileDown,
  FolderArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCards } from "@/components/StatCards";
import { FileDropzone } from "@/components/FileDropzone";
import { ColumnMapper } from "@/components/ColumnMapper";
import { WalkInDialog } from "@/components/WalkInDialog";
import { AttendeeTable } from "@/components/AttendeeTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { importAttendees, parseSpreadsheet, type ColumnMapping, type ParsedSheet } from "@/lib/importers";
import { downloadPassesPdf, downloadPassesZip, exportAttendanceReport } from "@/lib/exporters";
import { formatEventDate } from "@/lib/utils";

export default function EventDashboard() {
  const { eventId = "" } = useParams();
  // undefined = loading, null = not found
  const event = useLiveQuery(() => db.events.get(eventId).then((e) => e ?? null), [eventId]);
  const attendees = useLiveQuery(() => db.attendees.where("eventId").equals(eventId).toArray(), [eventId]);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [parsing, setParsing] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 6000);
  };

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      setSheet(await parseSpreadsheet(file));
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setParsing(false);
    }
  };

  const onConfirmMapping = async (mapping: ColumnMapping) => {
    if (!sheet) return;
    const r = await importAttendees(eventId, sheet, mapping);
    setSheet(null);
    flash(
      "ok",
      `Imported ${r.added} attendees with QR codes.` +
        (r.skippedDuplicates ? ` Skipped ${r.skippedDuplicates} duplicate(s).` : "") +
        (r.skippedEmpty ? ` Skipped ${r.skippedEmpty} row(s) without a name.` : ""),
    );
  };

  const runExport = async (label: string, fn: (onProgress: (d: number, t: number) => void) => Promise<void> | void) => {
    setExportProgress(label);
    try {
      await fn((d, t) => setExportProgress(`${label} ${d}/${t}`));
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExportProgress(null);
    }
  };

  if (event === undefined || attendees === undefined) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!event) {
    return (
      <AppShell>
        <Card className="p-10 text-center">
          <p className="font-semibold">Event not found.</p>
          <Button asChild variant="link">
            <Link to="/">Back to events</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      right={
        <Button asChild size="sm" variant="success">
          <Link to={`/scan/${event.id}`}>
            <ScanLine /> Scan
          </Link>
        </Button>
      }
    >
      <div className="mb-5">
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400" /> {formatEventDate(event.date)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-400" /> {event.location}
            </span>
          )}
          {event.organizer && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-400" /> {event.organizer}
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
            notice.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      <StatCards attendees={attendees} event={event} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Guest list</h2>
            <Button variant="outline" size="sm" onClick={() => setWalkInOpen(true)}>
              <UserPlus /> Add walk-in
            </Button>
          </div>
          <AttendeeTable attendees={attendees} event={event} />
        </section>

        <aside className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> Import attendees
            </h3>
            <FileDropzone onFile={onFile} busy={parsing} />
            <p className="mt-2 text-xs text-slate-500">Columns needed: Full Name, Email, Student/Ticket ID. You'll confirm the mapping next.</p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Download className="h-5 w-5 text-indigo-600" /> Downloads
            </h3>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start"
                disabled={!attendees.length || !!exportProgress}
                onClick={() => runExport("Building PDF", (p) => downloadPassesPdf(event, attendees, p))}
              >
                <FileDown /> All QR passes (PDF)
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={!attendees.length || !!exportProgress}
                onClick={() => runExport("Zipping PNGs", (p) => downloadPassesZip(event, attendees, p))}
              >
                <FolderArchive /> All QR passes (ZIP of PNGs)
              </Button>
              <Button
                className="justify-start"
                disabled={!attendees.length || !!exportProgress}
                onClick={() => runExport("Exporting", () => exportAttendanceReport(event, attendees))}
              >
                <FileSpreadsheet /> Export attendance report (.xlsx)
              </Button>
            </div>
            {exportProgress && (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {exportProgress}…
              </p>
            )}
          </Card>

          <Card className="bg-indigo-600 p-4 text-white">
            <h3 className="font-semibold">Door staff link</h3>
            <p className="mt-1 text-sm text-indigo-100">Open this on any phone or tablet with a camera:</p>
            <code className="mt-2 block break-all rounded-md bg-indigo-700/60 p-2 text-xs">
              {`${window.location.origin}/scan/${event.id}`}
            </code>
            <Button asChild variant="outline" className="mt-3 w-full border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Link to={`/scan/${event.id}`}>
                <ScanLine /> Open scanner
              </Link>
            </Button>
          </Card>
        </aside>
      </div>

      <ColumnMapper sheet={sheet} onCancel={() => setSheet(null)} onConfirm={onConfirmMapping} />
      <WalkInDialog eventId={eventId} open={walkInOpen} onOpenChange={setWalkInOpen} onAdded={() => flash("ok", "Walk-in added.")} />
    </AppShell>
  );
}
