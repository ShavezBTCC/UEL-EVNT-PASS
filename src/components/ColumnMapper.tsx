import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ColumnMapping, ParsedSheet } from "@/lib/importers";
import { guessColumns } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Props {
  sheet: ParsedSheet | null;
  fileName: string;
  onCancel: () => void;
  onConfirm: (mapping: ColumnMapping) => Promise<void>;
}

const FIELDS: { key: keyof ColumnMapping; label: string; optional: boolean }[] = [
  { key: "name", label: "Full Name", optional: false },
  { key: "email", label: "Email", optional: true },
  { key: "studentId", label: "Student / Ticket ID", optional: true },
];

export function ColumnMapper({ sheet, fileName, onCancel, onConfirm }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>({ name: 0, email: -1, studentId: -1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sheet) setMapping(guessColumns(sheet.headers));
  }, [sheet]);

  if (!sheet) return null;
  const preview = sheet.rows.slice(0, 3);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm columns</DialogTitle>
          <DialogDescription>
            {fileName} · {sheet.rows.length} rows. Check which column holds each field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`map-${f.key}`}>
                {f.label}
                {!f.optional && <span className="text-red-500"> *</span>}
              </Label>
              <Select
                id={`map-${f.key}`}
                value={mapping[f.key]}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
              >
                {f.optional && <option value={-1}>— None —</option>}
                {sheet.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        {preview.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-3 py-2 font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, r) => (
                  <tr key={r} className="border-t">
                    {FIELDS.map((f) => (
                      <td key={f.key} className="truncate px-3 py-2">
                        {mapping[f.key] >= 0 ? (
                          row[mapping[f.key]] || <span className="text-slate-300">empty</span>
                        ) : (
                          <span className="text-slate-400">{f.key === "studentId" ? "auto-generated" : "—"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Rows without a name are skipped. Rows whose ID or email already exist in this event are skipped as duplicates.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
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
            Import {sheet.rows.length} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
