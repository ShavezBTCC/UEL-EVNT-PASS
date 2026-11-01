import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".xlsx,.xls,.csv,.ods";

export function FileDropzone({ onFile, busy }: { onFile: (file: File) => void; busy?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition",
        dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50",
      )}
    >
      {busy ? <Loader2 className="h-8 w-8 animate-spin text-indigo-500" /> : <FileSpreadsheet className="h-8 w-8 text-indigo-500" />}
      <span className="text-sm font-medium">{busy ? "Reading file…" : "Drop an attendee spreadsheet or click to browse"}</span>
      <span className="text-xs text-muted-foreground">.xlsx, .xls, .csv — first row should contain column names</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
