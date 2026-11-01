import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { buildQrPayload, computeStats, type Attendee, type EventRecord } from "./db";
import { downloadBlob, formatDate, formatDateTime, slugify } from "./utils";

function sortByName(attendees: Attendee[]) {
  return [...attendees].sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Attendance report ---------- */

export function exportAttendanceReport(event: EventRecord, attendees: Attendee[]) {
  const stats = computeStats(attendees);
  const rows = sortByName(attendees).map((a) => ({
    "Full Name": a.name,
    Email: a.email,
    "Student/Ticket ID": a.externalId,
    Status: a.status === "checked_in" ? "Checked in" : "Not checked in",
    "Check-in Time": a.checkedInAt ? formatDateTime(a.checkedInAt) : "",
    "Walk-in": a.walkIn ? "Yes" : "No",
  }));

  const wb = XLSX.utils.book_new();
  const attendance = XLSX.utils.json_to_sheet(rows);
  attendance["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, attendance, "Attendance");

  const summary = XLSX.utils.aoa_to_sheet([
    ["Event", event.title],
    ["Date", formatDate(event.date)],
    ["Location", event.location],
    ["Organizer", event.organizer],
    ["Capacity", event.capacity ?? ""],
    [],
    ["Total registered", stats.total],
    ["Checked in", stats.checkedIn],
    ["Not checked in", stats.pending],
    ["Walk-ins", stats.walkIns],
    ["Attendance rate", stats.total ? `${Math.round((stats.checkedIn / stats.total) * 100)}%` : "0%"],
    [],
    ["Report generated", formatDateTime(Date.now())],
  ]);
  summary["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  XLSX.writeFile(wb, `${slugify(event.title)}-attendance.xlsx`);
}

/* ---------- QR images ---------- */

export function qrDataUrl(event: EventRecord, attendee: Attendee, width = 512) {
  return QRCode.toDataURL(buildQrPayload(event.id, attendee.qrToken), {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

type Progress = (done: number, total: number) => void;

/* ---------- PDF passes (6 per A4 page) ---------- */

export async function exportPassesPdf(event: EventRecord, attendees: Attendee[], onProgress?: Progress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const list = sortByName(attendees);

  const pageW = 210;
  const margin = 10;
  const cols = 2;
  const rowsPerPage = 3;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (297 - margin * 2) / rowsPerPage;
  const qrSize = 48;

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const slot = i % (cols * rowsPerPage);
    if (i > 0 && slot === 0) doc.addPage();
    const x = margin + (slot % cols) * cellW;
    const y = margin + Math.floor(slot / cols) * cellH;
    const pad = 3;

    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2, 3, 3);
    doc.setLineDashPattern([], 0);

    doc.setFillColor(79, 70, 229);
    doc.roundedRect(x + pad, y + pad, cellW - pad * 2, 14, 3, 3, "F");
    doc.rect(x + pad, y + pad + 8, cellW - pad * 2, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(event.title, cellW - 16)[0] as string, x + pad + 4, y + pad + 9);

    const img = await qrDataUrl(event, a, 400);
    doc.addImage(img, "PNG", x + (cellW - qrSize) / 2, y + 22, qrSize, qrSize);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(doc.splitTextToSize(a.name, cellW - 14)[0] as string, x + cellW / 2, y + 22 + qrSize + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`ID: ${a.externalId}`, x + cellW / 2, y + 22 + qrSize + 12, { align: "center" });
    const meta = [formatDate(event.date), event.location].filter(Boolean).join(" · ");
    if (meta) doc.text(doc.splitTextToSize(meta, cellW - 14)[0] as string, x + cellW / 2, y + 22 + qrSize + 16.5, { align: "center" });

    onProgress?.(i + 1, list.length);
  }

  doc.save(`${slugify(event.title)}-passes.pdf`);
}

/* ---------- ZIP of PNG passes ---------- */

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function exportPassesZip(event: EventRecord, attendees: Attendee[], onProgress?: Progress) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder("passes")!;
  const list = sortByName(attendees);
  const usedNames = new Set<string>();
  const index: string[] = ["name,email,id,token,qr_payload,file"];

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let base = `${slugify(a.name)}-${slugify(a.externalId)}`;
    while (usedNames.has(base)) base += "-1";
    usedNames.add(base);
    const file = `${base}.png`;

    const dataUrl = await qrDataUrl(event, a, 600);
    folder.file(file, dataUrl.split(",")[1], { base64: true });
    index.push(
      [a.name, a.email, a.externalId, a.qrToken, buildQrPayload(event.id, a.qrToken), `passes/${file}`].map(csvCell).join(","),
    );
    onProgress?.(i + 1, list.length);
  }

  zip.file("index.csv", index.join("\n"));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(event.title)}-passes.zip`);
}
