import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { guessMapping, NONE, type ColumnMapping, type ParsedSheet } from "@/lib/importers";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select } from "./ui/select";

const FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean; hint: string }[] = [
  { key: "fullName", label: "Full Name", required: true, hint: "Rows without a name are skipped" },
  { key: "email", label: "Email", hint: "Optional" },
  { key: "ticketId", label: "Student / Ticket ID", hint: "Optional — generated if missing" },
];

export function ColumnMapper({
  sheet,
  fileName,
  open,
  onOpenChange,
  onConfirm,
}: {
  sheet: ParsedSheet | null;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mapping: ColumnMapping) => Promise<void>;
}) {
  const [mapping, setMapping] = useState<ColumnMapping>({ fullName: NONE, email: NONE, ticketId: NONE });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sheet) setMapping(guessMapping(sheet.headers));
  }, [sheet]);

  const preview = sheet?.rows.slice(0, 3) ?? [];
  const cell = (row: Record<string, string>, col: string) => (col === NONE ? "—" : row[col] || "—");

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm columns</DialogTitle>
          <DialogDescription>
            {fileName} · {sheet?.rows.length ?? 0} rows found. Check which column holds each field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`map-${f.key}`}>
                {f.label}
                {f.required && <span className="text-rose-600"> *</span>}
              </Label>
              <Select
                id={`map-${f.key}`}
                value={mapping[f.key]}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
              >
                <option value={NONE}>— Not in sheet —</option>
                {sheet?.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500">{f.hint}</p>
            </div>
          ))}
        </div>

        {preview.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-3 py-2 font-semibold">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    {FIELDS.map((f) => (
                      <td key={f.key} className="max-w-[12rem] truncate px-3 py-2">
                        {cell(row, mapping[f.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || mapping.fullName === NONE}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(mapping);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Import {sheet?.rows.length ?? 0} attendees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
