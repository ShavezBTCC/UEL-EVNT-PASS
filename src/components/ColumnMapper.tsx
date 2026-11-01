import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { guessMapping, NONE, type ColumnMapping, type ParsedSheet } from "@/lib/importers";

const FIELDS: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: "name", label: "Full Name", hint: "Required" },
  { key: "email", label: "Email", hint: "Optional · used to detect duplicates" },
  { key: "externalId", label: "Student / Ticket ID", hint: "Optional · generated if missing" },
];

interface Props {
  sheet: ParsedSheet | null;
  onCancel: () => void;
  onConfirm: (mapping: ColumnMapping) => void;
  busy?: boolean;
}

export function ColumnMapper({ sheet, onCancel, onConfirm, busy }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>({ name: NONE, email: NONE, externalId: NONE });

  useEffect(() => {
    if (sheet) setMapping(guessMapping(sheet.headers));
  }, [sheet]);

  const preview = sheet?.rows.slice(0, 3) ?? [];
  const cell = (row: Record<string, unknown>, col: string) => (col === NONE ? "—" : String(row[col] ?? "") || "—");

  return (
    <Dialog open={!!sheet} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm columns</DialogTitle>
          <DialogDescription>
            {sheet?.fileName} · {sheet?.rows.length} rows. Check which column holds each field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
              <div>
                <Label>{f.label}</Label>
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
              <Select value={mapping[f.key]} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                <option value={NONE}>— Not in this file —</option>
                {sheet?.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        {preview.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-3 py-2 font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    {FIELDS.map((f) => (
                      <td key={f.key} className="max-w-[160px] truncate px-3 py-2">
                        {cell(row, mapping[f.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mapping.name === NONE && (
          <p className="text-xs text-amber-700">
            No name column selected — names will be built from “First name” / “Last name” columns if present, otherwise rows are skipped.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(mapping)} disabled={busy}>
            {busy ? "Importing…" : `Import ${sheet?.rows.length ?? 0} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
