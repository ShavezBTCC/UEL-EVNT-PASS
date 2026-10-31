import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import QRCode from "qrcode";
import { buildQrPayload, type Attendee, type EventRecord } from "./db";
import { downloadBlob, formatDate, formatDateTime, safeFileName } from "./utils";

function qrDataUrl(event: EventRecord, a: Attendee, width = 512) {
  return QRCode.toDataURL(buildQrPayload(event.id, a.qrToken), {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export function exportAttendanceReport(event: EventRecord, attendees: Attendee[]) {
  const sorted = [...attendees].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sorted.map((a) => ({
    "Full Name": a.name,
    Email: a.email,
    "Student/Ticket ID": a.studentId,
    Status: a.status === "checked_in" ? "Checked in" : "Not arrived",
    "Check-in Time": a.checkedInAt ? formatDateTime(a.checkedInAt) : "",
    "Walk-in": a.walkIn ? "Yes" : "No",
  }));
  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  const walkIns = attendees.filter((a) => a.walkIn).length;
  const summary = [
    ["Event", event.title],
    ["Date", formatDate(event.date)],
    ["Location", event.location],
    ["Organizer", event.organizer],
    ["Capacity", event.capacity ?? ""],
    [],
    ["Registered", attendees.length - walkIns],
    ["Walk-ins", walkIns],
    ["Total", attendees.length],
    ["Checked in", checkedIn],
    ["Not arrived", attendees.length - checkedIn],
    ["Attendance rate", attendees.length ? `${Math.round((checkedIn / attendees.length) * 100)}%` : "0%"],
    [],
    ["Report generated", formatDateTime(Date.now())],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const summaryWs = XLSX.utils.aoa_to_sheet(summary);
  summaryWs["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
  XLSX.writeFile(wb, `${safeFileName(event.title)}_attendance.xlsx`);
}

function truncate(doc: jsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** 6 passes per A4 page (2 × 3). */
export async function downloadPassesPdf(
  event: EventRecord,
  attendees: Attendee[],
  onProgress?: (done: number, total: number) => void,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 10;
  const cols = 2;
  const rowsPerPage = 3;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (297 - margin * 2) / rowsPerPage;
  const qrSize = 52;
  const sub = [formatDate(event.date), event.location].filter(Boolean).join(" · ");

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    const slot = i % (cols * rowsPerPage);
    if (i > 0 && slot === 0) doc.addPage();
    const x = margin + (slot % cols) * cellW;
    const y = margin + Math.floor(slot / cols) * cellH;
    const pad = 4;
    const innerW = cellW - pad * 2;

    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.roundedRect(x + 2, y + 2, cellW - 4, cellH - 4, 3, 3);
    doc.setLineDashPattern([], 0);

    doc.setFillColor(79, 70, 229);
    doc.roundedRect(x + pad, y + pad, innerW, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(truncate(doc, event.title, innerW - 6), x + pad + 3, y + pad + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(truncate(doc, sub, innerW - 6), x + pad + 3, y + pad + 11);

    const img = await qrDataUrl(event, a, 400);
    doc.addImage(img, "PNG", x + (cellW - qrSize) / 2, y + pad + 17, qrSize, qrSize);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(truncate(doc, a.name, innerW), x + cellW / 2, y + pad + 17 + qrSize + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(truncate(doc, `ID: ${a.studentId}`, innerW), x + cellW / 2, y + pad + 17 + qrSize + 11, {
      align: "center",
    });
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pass code ${a.qrToken}`, x + cellW / 2, y + pad + 17 + qrSize + 15.5, { align: "center" });

    onProgress?.(i + 1, attendees.length);
  }

  doc.save(`${safeFileName(event.title)}_passes.pdf`);
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** One PNG per attendee + index.csv for mail-merge. */
export async function downloadPassesZip(
  event: EventRecord,
  attendees: Attendee[],
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const folder = zip.folder("passes")!;
  const csv = ["name,email,student_id,qr_token,qr_payload,file"];
  const used = new Set<string>();

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    let base = `${safeFileName(a.name)}_${safeFileName(a.studentId)}`;
    while (used.has(base)) base += "_";
    used.add(base);
    const file = `${base}.png`;
    const dataUrl = await qrDataUrl(event, a, 600);
    folder.file(file, dataUrl.split(",")[1], { base64: true });
    csv.push(
      [a.name, a.email, a.studentId, a.qrToken, buildQrPayload(event.id, a.qrToken), `passes/${file}`]
        .map(csvCell)
        .join(","),
    );
    onProgress?.(i + 1, attendees.length);
  }
  zip.file("index.csv", csv.join("\n"));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${safeFileName(event.title)}_passes.zip`);
}
