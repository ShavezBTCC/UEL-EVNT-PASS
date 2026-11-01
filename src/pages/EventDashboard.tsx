import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CalendarDays, Download, FileArchive, FileText, Link2, MapPin, ScanLine, Trash2, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AttendeeTable } from "@/components/AttendeeTable";
import { ColumnMapper } from "@/components/ColumnMapper";
import { FileDropzone } from "@/components/FileDropzone";
import { StatCards } from "@/components/StatCards";
import { WalkInDialog } from "@/components/WalkInDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { computeStats, db, deleteEvent, getEventAttendees } from "@/lib/db";
import { exportAttendanceReport, exportPassesPdf, exportPassesZip } from "@/lib/exporters";
import { importAttendees, parseSpreadsheet, type ColumnMapping, type ParsedSheet } from "@/lib/importers";
import { formatDate } from "@/lib/utils";

type Notice = { tone: "success" | "error"; text: string } | null;

export default function EventDashboard() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const event = useLiveQuery(() => db.events.get(id), [id], null);
  const attendees = useLiveQuery(() => getEventAttendees(id), [id], []);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [exporting, setExporting] = useState<{ label: string; done: number; total: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  if (event === undefined) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <h1 className="text-lg font-semibold">Event not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or was created on another device.</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to events</Link>
          </Button>
        </div>
      </AppShell>
    );
  }
  if (event === null) return <AppShell>{null}</AppShell>;

  const stats = computeStats(attendees);

  const onFile = async (file: File) => {
    setNotice(null);
    setReading(true);
    try {
      setSheet(await parseSpreadsheet(file));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Couldn't read that file." });
    } finally {
      setReading(false);
    }
  };

  const onConfirmMapping = async (mapping: ColumnMapping) => {
    if (!sheet) return;
    setImporting(true);
    try {
      const r = await importAttendees(event.id, sheet, mapping);
      const parts = [`Imported ${r.added} attendee${r.added === 1 ? "" : "s"}.`];
      if (r.skippedDuplicates) parts.push(`${r.skippedDuplicates} duplicate${r.skippedDuplicates === 1 ? "" : "s"} skipped.`);
      if (r.skippedEmpty) parts.push(`${r.skippedEmpty} row${r.skippedEmpty === 1 ? "" : "s"} without a name skipped.`);
      setNotice({ tone: "success", text: parts.join(" ") });
      setSheet(null);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  const runExport = async (label: string, fn: typeof exportPassesPdf) => {
    if (attendees.length === 0) return;
    setExporting({ label, done: 0, total: attendees.length });
    try {
      await fn(event, attendees, (done, total) => setExporting({ label, done, total }));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Export failed." });
    } finally {
      setExporting(null);
    }
  };

  const scanUrl = `${window.location.origin}/scan/${event.id}`;
  const copyScanLink = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the scanner link:", scanUrl);
    }
  };

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to={`/scan/${event.id}`}>
              <ScanLine /> Scan
            </Link>
          </Button>
          <Button variant="outline" size="lg" onClick={copyScanLink}>
            <Link2 /> {copied ? "Copied!" : "Share scan link"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <StatCards stats={stats} capacity={event.capacity} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Import attendees</CardTitle>
              <CardDescription>Each attendee gets a unique QR token. Duplicates (same ID or email) are skipped.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FileDropzone onFile={onFile} busy={reading} />
              {notice && (
                <p
                  className={`rounded-md px-3 py-2 text-sm ${notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                >
                  {notice.text}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passes & reports</CardTitle>
              <CardDescription>Download passes to print or email, and export attendance after the event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" disabled={!attendees.length || !!exporting} onClick={() => runExport("PDF passes", exportPassesPdf)}>
                  <FileText /> Passes PDF (6 per page)
                </Button>
                <Button variant="outline" disabled={!attendees.length || !!exporting} onClick={() => runExport("PNG passes", exportPassesZip)}>
                  <FileArchive /> Passes ZIP (PNG + CSV)
                </Button>
              </div>
              <Button className="w-full" disabled={!attendees.length} onClick={() => exportAttendanceReport(event, attendees)}>
                <Download /> Export attendance report (.xlsx)
              </Button>
              {exporting && (
                <div className="space-y-1 pt-1">
                  <div className="text-xs text-muted-foreground">
                    Generating {exporting.label}… {exporting.done}/{exporting.total}
                  </div>
                  <Progress value={(exporting.done / exporting.total) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Attendees</h2>
            <WalkInDialog eventId={event.id} />
          </div>
          <AttendeeTable event={event} attendees={attendees} />
        </div>

        <div className="flex justify-end border-t pt-6">
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete event
          </Button>
        </div>
      </div>

      <ColumnMapper sheet={sheet} busy={importing} onCancel={() => setSheet(null)} onConfirm={onConfirmMapping} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{event.title}”?</DialogTitle>
            <DialogDescription>
              This removes the event and all {attendees.length} attendees from this device. Export the attendance report first if you need it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteEvent(event.id);
                navigate("/");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
