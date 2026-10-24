import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PayslipPdfInput {
  company: string;
  monthLabel: string;
  employeeName: string;
  employeeCode: string;
  department?: string | null;
  designation?: string | null;
  joinDate?: string | null;
  slip: {
    basic: number; hra: number; medical: number; gross: number;
    working_days: number; eligible_days: number | string;
    absent_days: number | string; unpaid_days: number | string; half_days: number | string;
    deduction: number; taxable_annual: number; tax: number; net: number;
    details?: { daily_rate?: number; deduction_days?: number } | null;
  };
  status: string;
}

const money = (n?: number | null) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function payslipPdf(input: PayslipPdfInput): Promise<Uint8Array> {
  const { slip } = input;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.18), muted = rgb(0.45, 0.5, 0.6), brand = rgb(0.31, 0.27, 0.9), line = rgb(0.85, 0.87, 0.92);

  let y = 792;
  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: brand });
  page.drawText(input.company, { x: 40, y: 816, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Payslip — ${input.monthLabel}`, { x: 40, y: 784, size: 11, font: bold, color: muted });

  y = 748;
  const info: [string, string][] = [
    ["Employee", `${input.employeeName} (${input.employeeCode})`],
    ["Department", input.department || "—"],
    ["Designation", input.designation || "—"],
    ["Join date", input.joinDate || "—"],
    ["Status", input.status === "finalized" ? "Finalized" : "Draft (not finalized)"],
  ];
  for (const [k, v] of info) {
    page.drawText(k, { x: 40, y, size: 9, font: bold, color: muted });
    page.drawText(String(v), { x: 150, y, size: 10, font, color: ink });
    y -= 18;
  }

  y -= 10;
  page.drawText("Earnings", { x: 40, y, size: 11, font: bold, color: ink });
  y -= 18;
  const rows: [string, string][] = [
    ["Basic salary", money(slip.basic)],
    ["House rent allowance (40%)", money(slip.hra)],
    ["Medical allowance (10%)", money(slip.medical)],
    ["Gross (1.5 × basic)", money(slip.gross)],
  ];
  for (const [k, v] of rows) {
    page.drawText(k, { x: 48, y, size: 10, font, color: ink });
    const w = font.widthOfTextAtSize(v, 10);
    page.drawText(v, { x: 530 - w, y, size: 10, font, color: ink });
    y -= 16;
  }

  y -= 12;
  page.drawText("Attendance & deductions", { x: 40, y, size: 11, font: bold, color: ink });
  y -= 18;
  const d = slip.details ?? {};
  const drows: [string, string][] = [
    ["Working days in month / eligible", `${slip.working_days} / ${slip.eligible_days}`],
    ["Daily rate", money(d.daily_rate ?? 0)],
    ["Absent days", String(slip.absent_days)],
    ["Unpaid leave days", String(slip.unpaid_days)],
    ["Half days (×0.5)", `${slip.half_days} (${d.deduction_days ?? 0} deducted total)`],
    ["Attendance deduction", `- ${money(slip.deduction)}`],
    ["Taxable annual gross (×12)", money(slip.taxable_annual)],
    ["Monthly tax (slab)", `- ${money(slip.tax)}`],
  ];
  for (const [k, v] of drows) {
    page.drawText(k, { x: 48, y, size: 10, font, color: ink });
    const w = font.widthOfTextAtSize(v, 10);
    page.drawText(v, { x: 530 - w, y, size: 10, font, color: ink });
    y -= 16;
  }

  y -= 14;
  page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 530, y: y + 10 }, thickness: 1, color: line });
  page.drawText("NET PAY", { x: 40, y, size: 13, font: bold, color: ink });
  const net = money(slip.net);
  const nw = bold.widthOfTextAtSize(net, 13);
  page.drawText(net, { x: 530 - nw, y, size: 13, font: bold, color: brand });

  y -= 40;
  const note = "System-generated payslip. Gross = 1.5 × basic; deductions = absent + unpaid leave + 0.5 × half days; tax from annual slab ÷ 12.";
  page.drawText(note, { x: 40, y, size: 7.5, font, color: muted, maxWidth: 500 });
  page.drawText(`Generated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, { x: 40, y: y - 12, size: 7.5, font, color: muted });

  return pdf.save();
}
