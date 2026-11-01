import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { guessMapping, type ColumnMapping, type ParsedSheet } from "@/lib/importers";
import { Loader2 } from "lucide-react";

interface Props {
  sheet: ParsedSheet | null;
  onCancel: () => void;
  onConfirm: (mapping: ColumnMapping) => Promise<void>;
}

export function ColumnMapper({ sheet, onCancel, onConfirm }: Props) {
  const initial = useMemo(() => (sheet ? guessMapping(sheet.headers) : { fullName: "", email: "", ticketId: "" }), [sheet]);
  const [mapping, setMapping] = useState<ColumnMapping>(initial);
  const [busy, setBusy] = useState(false);

  // Reset when a new sheet arrives
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setMapping(initial);
  }

  if (!sheet) return null;
  const preview = sheet.rows.slice(0, 3);
  const fields: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
    { key: "fullName", label: "Full Name", required: true },
    { key: "email", label: "Email", required: false },
    { key: "ticketId", label: "Student ID / Ticket ID", required: false },
  ];

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(mapping);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!sheet} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map your columns</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-slate-700">{sheet.fileName}</span> · {sheet.rows.length} rows found. Tell us which column holds each field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`map-${f.key}`}>
                {f.label} {f.required ? <span className="text-red-500">*</span> : <span className="text-slate-400">(optional)</span>}
              </Label>
              <Select id={`map-${f.key}`} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                <option value="">— not in sheet —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview (first {preview.length} rows)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Full Name</th>
                  <th className="pb-1 pr-4 font-medium">Email</th>
                  <th className="pb-1 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-1 pr-4">{mapping.fullName ? r[mapping.fullName] : <em className="text-slate-400">—</em>}</td>
                    <td className="py-1 pr-4">{mapping.email ? r[mapping.email] : <em className="text-slate-400">—</em>}</td>
                    <td className="py-1">{mapping.ticketId ? r[mapping.ticketId] : <em className="text-slate-400">auto</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!mapping.fullName || busy}>
            {busy && <Loader2 className="animate-spin" />}
            Import {sheet.rows.length} attendees & generate QR codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
