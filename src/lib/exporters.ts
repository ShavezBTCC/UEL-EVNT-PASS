import * as XLSX from "xlsx";
import * as QRCode from "qrcode";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { buildQrPayload, type Attendee, type EventSession } from "./db";
import { formatDateTime, slugify } from "./utils";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Export the attendance report as .xlsx with names, status and exact timestamps. */
export function exportAttendanceReport(event: EventSession, attendees: Attendee[]) {
  const sorted = [...attendees].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const rows = sorted.map((a) => ({
    "Full Name": a.fullName,
    Email: a.email,
    "Student / Ticket ID": a.ticketId,
    Status: a.status === "checked_in" ? "Checked In" : "Not Checked In",
    "Check-in Time": a.checkedInAt ? formatDateTime(a.checkedInAt) : "",
    "Check-in Time (ISO)": a.checkedInAt ? new Date(a.checkedInAt).toISOString() : "",
    Type: a.isWalkIn ? "Walk-in" : "Pre-registered",
    "QR Token": a.qrToken,
  }));

  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;
  const summary = [
    { Metric: "Event", Value: event.title },
    { Metric: "Date", Value: event.date },
    { Metric: "Location", Value: event.location },
    { Metric: "Organizer", Value: event.organizer },
    { Metric: "Total Guests", Value: attendees.length },
    { Metric: "Checked In", Value: checkedIn },
    { Metric: "Pending", Value: attendees.length - checkedIn },
    { Metric: "Walk-ins", Value: attendees.filter((a) => a.isWalkIn).length },
    { Metric: "Report Generated", Value: formatDateTime(Date.now()) },
  ];

  const wb = XLSX.utils.book_new();
  const wsAttendees = XLSX.utils.json_to_sheet(rows);
  wsAttendees["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsAttendees, "Attendance");
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${slugify(event.title) || "event"}-attendance-${event.date}.xlsx`,
  );
}

/** Download one PNG QR pass per attendee, zipped. */
export async function downloadPassesZip(
  event: EventSession,
  attendees: Attendee[],
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const folder = zip.folder("qr-passes")!;
  let i = 0;
  for (const a of attendees) {
    const dataUrl = await QRCode.toDataURL(buildQrPayload(event.id, a.qrToken), {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const base64 = dataUrl.split(",")[1];
    folder.file(`${slugify(a.ticketId) || "pass"}-${slugify(a.fullName) || "attendee"}.png`, base64, { base64: true });
    onProgress?.(++i, attendees.length);
  }
  const csv = ["Full Name,Email,Ticket ID,QR Payload"]
    .concat(attendees.map((a) => [a.fullName, a.email, a.ticketId, buildQrPayload(event.id, a.qrToken)].map(csvEscape).join(",")))
    .join("\n");
  zip.file("index.csv", csv);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(event.title) || "event"}-qr-passes.zip`);
}

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Download a printable PDF: 6 passes per A4 page (2 cols × 3 rows). */
export async function downloadPassesPdf(
  event: EventSession,
  attendees: Attendee[],
  onProgress?: (done: number, total: number) => void,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const cols = 2;
  const rows = 3;
  const margin = 10;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = (pageH - margin * 2) / rows;
  const qrSize = 48;

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = margin + col * cellW;
    const y = margin + row * cellH;

    // Card outline
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + 2, y + 2, cellW - 4, cellH - 4, 3, 3);

    // Header band
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(x + 2, y + 2, cellW - 4, 12, 3, 3, "F");
    doc.rect(x + 2, y + 9, cellW - 4, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(truncate(event.title, 40), x + cellW / 2, y + 9.5, { align: "center" });

    // QR
    const dataUrl = await QRCode.toDataURL(buildQrPayload(event.id, a.qrToken), { width: 400, margin: 1 });
    doc.addImage(dataUrl, "PNG", x + (cellW - qrSize) / 2, y + 18, qrSize, qrSize);

    // Attendee details
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(truncate(a.fullName, 32), x + cellW / 2, y + 73, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`ID: ${truncate(a.ticketId, 30)}`, x + cellW / 2, y + 79, { align: "center" });
    if (a.email) doc.text(truncate(a.email, 40), x + cellW / 2, y + 84, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${event.date}  ·  ${truncate(event.location, 36)}`, x + cellW / 2, y + cellH - 6, { align: "center" });
    onProgress?.(i + 1, attendees.length);
  }
  doc.save(`${slugify(event.title) || "event"}-qr-passes.pdf`);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
