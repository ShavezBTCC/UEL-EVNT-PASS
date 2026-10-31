import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { qrPayload, type Attendee, type EventSession } from "./db";
import { formatDate, formatDateTime, safeFileName } from "./utils";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAttendanceReport(event: EventSession, attendees: Attendee[]) {
  const sorted = [...attendees].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const rows = sorted.map((a) => ({
    "Full Name": a.fullName,
    Email: a.email,
    "Student/Ticket ID": a.ticketId,
    Status: a.checkedIn ? "Checked In" : "Not Checked In",
    "Check-in Time": a.checkedInAt ? formatDateTime(a.checkedInAt) : "",
    "Check-in ISO": a.checkedInAt ? new Date(a.checkedInAt).toISOString() : "",
    "Walk-in": a.walkIn ? "Yes" : "No",
  }));
  const checked = attendees.filter((a) => a.checkedIn).length;
  const summary = [
    { Field: "Event", Value: event.title },
    { Field: "Date", Value: formatDate(event.date) },
    { Field: "Location", Value: event.location },
    { Field: "Organizer", Value: event.organizer },
    { Field: "Total guests", Value: attendees.length },
    { Field: "Checked in", Value: checked },
    { Field: "Pending", Value: attendees.length - checked },
    { Field: "Walk-ins", Value: attendees.filter((a) => a.walkIn).length },
    { Field: "Exported at", Value: formatDateTime(Date.now()) },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 26 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  XLSX.writeFile(wb, `${safeFileName(event.title)}_attendance.xlsx`);
}

function qrDataUrl(event: EventSession, a: Attendee): Promise<string> {
  return QRCode.toDataURL(qrPayload(event.id, a.qrToken), { margin: 1, width: 512, errorCorrectionLevel: "M" });
}

type Progress = (done: number, total: number) => void;

/** A4 PDF with 6 passes per page (2 columns × 3 rows). */
export async function exportPassesPdf(event: EventSession, attendees: Attendee[], onProgress?: Progress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 10;
  const cols = 2;
  const rows = 3;
  const cardW = (pageW - margin * 2 - 6) / cols;
  const cardH = (297 - margin * 2 - 12) / rows;

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const x = margin + (slot % cols) * (cardW + 6);
    const y = margin + Math.floor(slot / cols) * (cardH + 6);

    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(x, y, cardW, cardH, 3, 3);
    doc.setLineDashPattern([], 0);

    doc.setFillColor(79, 70, 229);
    doc.roundedRect(x, y, cardW, 12, 3, 3, "F");
    doc.rect(x, y + 6, cardW, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(event.title, cardW - 8)[0] ?? "", x + 4, y + 8);

    const qrSize = 46;
    doc.addImage(await qrDataUrl(event, a), "PNG", x + (cardW - qrSize) / 2, y + 15, qrSize, qrSize);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(doc.splitTextToSize(a.fullName, cardW - 8)[0] ?? "", x + cardW / 2, y + 67, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`ID: ${a.ticketId}`, x + cardW / 2, y + 72, { align: "center" });
    const meta = [formatDate(event.date), event.location].filter(Boolean).join(" · ");
    if (meta) doc.text(doc.splitTextToSize(meta, cardW - 8)[0] ?? "", x + cardW / 2, y + 77, { align: "center" });

    onProgress?.(i + 1, attendees.length);
  }
  doc.save(`${safeFileName(event.title)}_passes.pdf`);
}

/** ZIP of PNG passes + index.csv for mail-merge. */
export async function exportPassesZip(event: EventSession, attendees: Attendee[], onProgress?: Progress) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder("passes")!;
  const csv: string[] = ["full_name,email,ticket_id,qr_token,qr_payload,file"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    const file = `${safeFileName(a.ticketId)}_${safeFileName(a.fullName)}.png`;
    const dataUrl = await qrDataUrl(event, a);
    folder.file(file, dataUrl.split(",")[1], { base64: true });
    csv.push([a.fullName, a.email, a.ticketId, a.qrToken, qrPayload(event.id, a.qrToken), `passes/${file}`].map(esc).join(","));
    onProgress?.(i + 1, attendees.length);
  }
  zip.file("index.csv", csv.join("\n"));
  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `${safeFileName(event.title)}_passes.zip`);
}
