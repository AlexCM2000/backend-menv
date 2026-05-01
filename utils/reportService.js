import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

// ─── Brand ───────────────────────────────────────────────────────────────────
const B = {
  primary:    "#1E40AF",
  primaryDark:"#1E3A8A",
  accent:     "#3B82F6",
  headerText: "#FFFFFF",
  altRow:     "#F1F5F9",
  border:     "#CBD5E1",
  textDark:   "#1E293B",
  textMid:    "#475569",
  summaryBg:  "#EFF6FF",
  titleBg:    "#DBEAFE",
};

// ─── Helper: Excel column letter ─────────────────────────────────────────────
function colLetter(n) {
  let r = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    r = String.fromCharCode(65 + rem) + r;
    n = Math.floor((n - 1) / 26);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export const buildExcel = async ({ title, filters, columns, rows, summary }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGMED-PA";
  wb.created = new Date();

  const ws = wb.addWorksheet(title.substring(0, 31), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const lastCol = colLetter(columns.length);

  // ── Fila 1: Título ──────────────────────────────────────────────────────────
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 15, color: { argb: "FF1E40AF" }, name: "Calibri" };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  ws.getRow(1).height = 32;

  // ── Fila 2: Generado + total ────────────────────────────────────────────────
  ws.mergeCells(`A2:${lastCol}2`);
  const metaCell = ws.getCell("A2");
  metaCell.value = `Generado: ${dayjs().format("DD/MM/YYYY HH:mm")}   |   Total registros: ${rows.length}   |   SIGMED-PA`;
  metaCell.font = { size: 8.5, color: { argb: "FF64748B" }, italic: true };
  metaCell.alignment = { horizontal: "left", vertical: "middle" };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  ws.getRow(2).height = 17;

  // ── Fila 3: Filtros ─────────────────────────────────────────────────────────
  ws.mergeCells(`A3:${lastCol}3`);
  const filterCell = ws.getCell("A3");
  filterCell.value = `Filtros aplicados: ${filters}`;
  filterCell.font = { size: 8, color: { argb: "FF475569" } };
  filterCell.alignment = { horizontal: "left", vertical: "middle" };
  filterCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  ws.getRow(3).height = 15;

  // ── Fila 4: Espaciador ──────────────────────────────────────────────────────
  ws.getRow(4).height = 5;

  // ── Fila 5: Cabeceras ───────────────────────────────────────────────────────
  const headerRow = ws.getRow(5);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF1E3A8A" } },
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
      left:   { style: "thin", color: { argb: "FF1E3A8A" } },
      right:  { style: "thin", color: { argb: "FF1E3A8A" } },
    };
  });
  headerRow.height = 22;

  // ── Filas 6+: Datos ─────────────────────────────────────────────────────────
  rows.forEach((row, rowIdx) => {
    const dataRow = ws.getRow(6 + rowIdx);
    const isAlt = rowIdx % 2 === 1;
    columns.forEach((col, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      cell.value = row[col.key] ?? "";
      cell.font = { size: 8.5, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? "FFF1F5F9" : "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = {
        top:    { style: "hair", color: { argb: "FFCBD5E1" } },
        bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
        left:   { style: "hair", color: { argb: "FFCBD5E1" } },
        right:  { style: "hair", color: { argb: "FFCBD5E1" } },
      };
    });
    dataRow.height = 16;
  });

  // ── Resumen ─────────────────────────────────────────────────────────────────
  if (summary?.length > 0) {
    const startRow = 6 + rows.length + 2;

    ws.mergeCells(`A${startRow}:${lastCol}${startRow}`);
    const sumTitle = ws.getCell(`A${startRow}`);
    sumTitle.value = "RESUMEN";
    sumTitle.font = { bold: true, size: 9, color: { argb: "FF1E40AF" } };
    sumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    sumTitle.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(startRow).height = 18;

    summary.forEach((item, i) => {
      const rn = startRow + 1 + i;
      const lc = ws.getCell(`A${rn}`);
      const vc = ws.getCell(`B${rn}`);
      lc.value = item.label;
      lc.font = { size: 8.5, color: { argb: "FF475569" } };
      lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      vc.value = item.value;
      vc.font = { bold: true, size: 8.5, color: { argb: "FF1E40AF" } };
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      ws.getRow(rn).height = 15;
    });
  }

  // ── Anchos de columna ───────────────────────────────────────────────────────
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.excelWidth ?? 16;
  });

  // ── AutoFilter ──────────────────────────────────────────────────────────────
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columns.length } };

  return wb.xlsx.writeBuffer();
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD PDF
// ═══════════════════════════════════════════════════════════════════════════════
export const buildPDF = ({ title, filters, columns, rows, summary }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
      info: { Title: title, Author: "SIGMED-PA", Creator: "SIGMED-PA" },
      bufferPages: true,
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin    = 40;
    const pageW     = doc.page.width;   // 841.89
    const contentW  = pageW - margin * 2;
    const pageH     = doc.page.height;  // 595.28
    const pageBottom = pageH - 45;
    let pageNum = 0;

    // ── Logo + header bar ────────────────────────────────────────────────────
    const drawPageHeader = () => {
      pageNum++;
      // Blue bar
      doc.rect(0, 0, pageW, 52).fill(B.primary);

      // Logo: circle + cross
      const lx = margin + 18, ly = 16;
      doc.circle(lx, ly + 10, 15).fill("#FFFFFF");
      doc.rect(lx - 8, ly + 7,  16, 6).fill(B.primary);  // horizontal
      doc.rect(lx - 3, ly + 2,  6, 16).fill(B.primary);  // vertical

      // System name
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15)
        .text("SIGMED-PA", margin + 42, ly + 2);
      doc.fillColor("#BFDBFE").font("Helvetica").fontSize(8)
        .text("Gestión de Salud", margin + 42, ly + 19);

      // Date + page
      doc.fillColor("#BFDBFE").fontSize(7.5)
        .text(dayjs().format("DD/MM/YYYY HH:mm"), pageW - margin - 100, ly + 6, { width: 95, align: "right" });
      doc.fillColor("#BFDBFE").fontSize(7)
        .text(`Página ${pageNum}`, pageW - margin - 100, ly + 20, { width: 95, align: "right" });

      doc.y = 62;
    };

    // ── Primera página ───────────────────────────────────────────────────────
    drawPageHeader();

    // Título del reporte
    doc.fillColor(B.textDark).font("Helvetica-Bold").fontSize(13)
      .text(title.toUpperCase(), margin, doc.y, { width: contentW });
    doc.moveDown(0.25);
    doc.strokeColor(B.accent).lineWidth(1.5)
      .moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).stroke();
    doc.moveDown(0.4);

    // Generado + filtros
    doc.fillColor(B.textMid).font("Helvetica").fontSize(8)
      .text(`Generado: ${dayjs().format("DD/MM/YYYY HH:mm")}   |   Total registros: ${rows.length}`, margin, doc.y);
    doc.moveDown(0.2);
    doc.fillColor(B.textMid).fontSize(7.5)
      .text(`Filtros: ${filters}`, margin, doc.y, { width: contentW });
    doc.moveDown(0.7);

    // ── Tabla ────────────────────────────────────────────────────────────────
    const TH = 22;  // header height
    const TR = 17;  // row height
    const TP = { l: 4, t: 5 };

    // Calcular anchos proporcionales
    const totalWeight = columns.reduce((s, c) => s + c.width, 0);
    const cw = columns.map((c) => Math.floor((c.width / totalWeight) * contentW));
    cw[cw.length - 1] += contentW - cw.reduce((s, w) => s + w, 0);

    const drawHeader = (y) => {
      let cx = margin;
      columns.forEach((col, i) => {
        doc.rect(cx, y, cw[i], TH).fill(B.primary);
        doc.fillColor(B.headerText).font("Helvetica-Bold").fontSize(8)
          .text(col.label, cx + TP.l, y + TP.t, {
            width: cw[i] - TP.l * 2, height: TH - TP.t, ellipsis: true, lineBreak: false,
          });
        cx += cw[i];
      });
      return y + TH;
    };

    const drawRow = (row, y, isAlt) => {
      let cx = margin;
      columns.forEach((col, i) => {
        doc.rect(cx, y, cw[i], TR).fill(isAlt ? B.altRow : "#FFFFFF");
        doc.rect(cx, y, cw[i], TR).lineWidth(0.3).stroke(B.border);
        doc.fillColor(B.textDark).font("Helvetica").fontSize(7.5)
          .text(String(row[col.key] ?? ""), cx + TP.l, y + TP.t, {
            width: cw[i] - TP.l * 2, height: TR - TP.t, ellipsis: true, lineBreak: false,
          });
        cx += cw[i];
      });
      return y + TR;
    };

    let y = doc.y;

    // Cabecera de tabla
    if (y + TH > pageBottom) { doc.addPage(); drawPageHeader(); y = doc.y; }
    y = drawHeader(y);

    // Filas de datos
    rows.forEach((row, idx) => {
      if (y + TR > pageBottom) {
        doc.addPage();
        drawPageHeader();
        y = doc.y;
        y = drawHeader(y);
      }
      y = drawRow(row, y, idx % 2 === 1);
    });

    // ── Resumen ──────────────────────────────────────────────────────────────
    if (summary?.length > 0) {
      const boxH = 22 + summary.length * 15 + 8;
      if (y + boxH + 16 > pageBottom) {
        doc.addPage();
        drawPageHeader();
        y = doc.y;
      }
      y += 14;

      doc.rect(margin, y, contentW, boxH).fill(B.summaryBg);
      doc.rect(margin, y, contentW, boxH).lineWidth(0.5).stroke(B.accent);
      doc.fillColor(B.primary).font("Helvetica-Bold").fontSize(9)
        .text("RESUMEN", margin + 8, y + 6);
      y += 22;

      summary.forEach((item) => {
        doc.fillColor(B.textMid).font("Helvetica").fontSize(8.5)
          .text(`${item.label}:`, margin + 10, y);
        doc.fillColor(B.primary).font("Helvetica-Bold").fontSize(8.5)
          .text(String(item.value), margin + 180, y);
        y += 15;
      });
    }

    doc.end();
  });
};
