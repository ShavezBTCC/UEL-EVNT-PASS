import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

export function FileDropzone({ onFile, busy }: { onFile: (f: File) => void; busy?: boolean }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-700">
        {busy ? <FileSpreadsheet className="h-6 w-6 animate-pulse" /> : <UploadCloud className="h-6 w-6" />}
      </span>
      <div>
        <p className="font-semibold text-slate-800">{busy ? "Reading file…" : "Drop your attendee sheet here"}</p>
        <p className="text-sm text-slate-500">or tap to browse · .xlsx, .xls or .csv</p>
      </div>
    </div>
  );
}
