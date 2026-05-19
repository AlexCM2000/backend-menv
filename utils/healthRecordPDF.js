import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO = join(__dirname, "../assets/SIGMED-PA_icono_claro_512.png");

// Paleta blanco/negro — sin colores
const C = {
  dark:    "#1A1A1A",
  charcoal:"#4A4A4A",
  gray50:  "#FAFAFA",
  gray100: "#F5F5F5",
  gray200: "#E5E5E5",
  gray300: "#D4D4D4",
  gray400: "#A3A3A3",
  gray600: "#525252",
  gray800: "#262626",
  white:   "#FFFFFF",
};

const fmt    = (d) => d ? dayjs(d).format("DD/MM/YYYY") : "—";
const fullNm = (p) => p ? [p.primerApellido, p.segundoApellido, p.nombres].filter(Boolean).join(" ") : "—";
const userNm = (u) => u ? [u.primerApellido, u.nombres].filter(Boolean).join(" ") : "—";
const str    = (v) => (v === null || v === undefined || v === "") ? "—" : String(v);

// ──────────────────────────────────────────────────────────────────────────────
export const generateHealthRecordPDF = (record) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      info: { Title: "Historial Clínico", Author: "SIGMED-PA", Creator: "SIGMED-PA" },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const M      = 45;
    const PW     = doc.page.width;   // 595.28
    const PH     = doc.page.height;  // 841.89
    const CW     = PW - M * 2;      // 505.28
    const BOTTOM = PH - 46;         // 795.89
    let pageNum  = 0;

    // ── Encabezado ────────────────────────────────────────────────────────────
    const drawPageHeader = () => {
      pageNum++;

      // Regla negra fina superior (sin color)
      doc.rect(0, 0, PW, 1.5).fill(C.dark);

      const LB = 30;
      doc.rect(M, 9, LB, LB).fill(C.dark);
      try { doc.image(LOGO, M + 3, 12, { width: LB - 6, height: LB - 6 }); } catch { /* logo opcional */ }

      doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(10)
         .text("SIGMED-PA", M + LB + 8, 11, { lineBreak: false });
      doc.fillColor(C.gray600).font("Helvetica").fontSize(5.5)
         .text("G.A.M.P.A. — Sistema de Gestión de Salud — La Paz, Bolivia",
           M + LB + 8, 24, { lineBreak: false });

      doc.fillColor(C.gray400).font("Helvetica").fontSize(6)
         .text(`Página ${pageNum}  ·  ${dayjs().format("DD/MM/YYYY HH:mm")}`,
           M, 12, { width: CW, align: "right", lineBreak: false });
      doc.fillColor(C.gray400).fontSize(5.5)
         .text(`Folio: ${record._id.toString().slice(-10).toUpperCase()}`,
           M, 24, { width: CW, align: "right", lineBreak: false });

      doc.rect(M, 46, CW, 0.5).fill(C.gray300);
      drawPageFooter();
      doc.y = 55;
      doc.x = M;
    };

    // ── Pie de página ─────────────────────────────────────────────────────────
    const drawPageFooter = () => {
      const y = PH - 26;
      doc.rect(0, y, PW, 26).fill(C.gray50);
      doc.rect(0, y, PW, 0.5).fill(C.gray300);
      const pat = record.patient || {};
      // Desactivar margen inferior temporalmente para evitar que doc.text()
      // auto-cree una nueva página al escribir cerca del fondo de la hoja.
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(C.gray400).font("Helvetica").fontSize(6.5)
         .text(
           `${fullNm(pat)}  ·  SUS: ${pat.susCode || "—"}  ·  Uso médico exclusivo — SIGMED-PA`,
           M, y + 9, { width: CW, align: "center", lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    };

    // ── Título de sección ─────────────────────────────────────────────────────
    const sectionTitle = (label, count) => {
      if (doc.y > BOTTOM - 78) { doc.addPage(); drawPageHeader(); }
      const y = doc.y;
      doc.rect(M, y, CW, 17).fill(C.gray100);
      doc.rect(M, y, 3, 17).fill(C.charcoal);
      doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7.5)
         .text(label.toUpperCase(), M + 10, y + 5, { lineBreak: false });
      if (count !== undefined) {
        const lw = doc.widthOfString(label.toUpperCase(), { fontSize: 7.5 });
        doc.fillColor(C.gray400).font("Helvetica").fontSize(7)
           .text(`(${count})`, M + 10 + lw + 4, y + 5.5, { lineBreak: false });
      }
      doc.y = y + 20;
    };

    // ── Grid de datos tipo formulario ─────────────────────────────────────────
    const drawDataGrid = (fields, numCols = 4) => {
      const CELL_H = 22;
      const cellW  = CW / numCols;

      let col = 0, rows = 1;
      fields.forEach((f) => {
        col += (f.span || 1);
        if (col >= numCols) { col = 0; rows++; }
      });
      if (col === 0) rows--;

      const startY = doc.y;
      const gridH  = rows * CELL_H;
      doc.rect(M, startY, CW, gridH).stroke(C.gray300);

      col = 0;
      let rowY = startY, rowNum = 0;

      fields.forEach((field) => {
        const span = field.span || 1;
        const w    = cellW * span;
        const x    = M + col * cellW;

        if (col > 0) doc.rect(x, rowY, 0.5, CELL_H).fill(C.gray300);

        doc.fillColor(C.gray400).font("Helvetica").fontSize(5.5)
           .text(field.label.toUpperCase(), x + 4, rowY + 3,
             { width: w - 8, lineBreak: false, ellipsis: true });

        doc.fillColor(C.gray800).font("Helvetica-Bold").fontSize(8)
           .text(str(field.value), x + 4, rowY + 11,
             { width: w - 8, lineBreak: false, ellipsis: true });

        col += span;
        if (col >= numCols) {
          col = 0;
          rowNum++;
          if (rowNum < rows) doc.rect(M, rowY + CELL_H, CW, 0.5).fill(C.gray300);
          rowY += CELL_H;
        }
      });

      if (col > 0) rowY += CELL_H;
      doc.y = rowY + 5;
    };

    // ── Tabla genérica con filas de altura variable ───────────────────────────
    const drawTable = (headers, rows, colWidths) => {
      const totalW  = colWidths.reduce((a, b) => a + b, 0);
      const HDR_H   = 16;
      const MIN_H   = 15;
      const PAD     = 4;
      const FS      = 7.5;

      // Altura real que ocupa el texto de una celda
      const cellH = (text, ci) => {
        const font = ci === 0 ? "Helvetica-Bold" : "Helvetica";
        doc.font(font).fontSize(FS);
        return doc.heightOfString(str(text), { width: colWidths[ci] - PAD * 2 });
      };

      // Altura de fila = máximo de todas las celdas + padding vertical
      const rowHeight = (row) =>
        Math.max(MIN_H, ...row.map((cell, ci) => cellH(cell, ci) + 8));

      const renderHeader = () => {
        const y = doc.y;
        doc.rect(M, y, totalW, HDR_H).fill(C.gray200);
        doc.rect(M, y, totalW, 1).fill(C.charcoal);
        let x = M;
        headers.forEach((h, i) => {
          doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(6.5)
             .text(h.toUpperCase(), x + PAD, y + 5,
               { width: colWidths[i] - PAD * 2, lineBreak: false, ellipsis: true });
          x += colWidths[i];
        });
        doc.y = y + HDR_H;
      };

      if (doc.y > BOTTOM - 55) { doc.addPage(); drawPageHeader(); }
      renderHeader();

      rows.forEach((row, ri) => {
        const rh = rowHeight(row);
        if (doc.y + rh > BOTTOM) { doc.addPage(); drawPageHeader(); renderHeader(); }
        const rowY = doc.y;
        if (ri % 2 === 1) doc.rect(M, rowY, totalW, rh).fill(C.gray50);
        doc.rect(M, rowY + rh - 0.5, totalW, 0.5).fill(C.gray300);

        let cx = M;
        row.forEach((cell, ci) => {
          doc.fillColor(ci === 0 ? C.gray800 : C.gray600)
             .font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
             .fontSize(FS)
             .text(str(cell), cx + PAD, rowY + 4,
               { width: colWidths[ci] - PAD * 2 });
          cx += colWidths[ci];
        });
        doc.y = rowY + rh;
      });

      doc.y += 5;
    };

    // ── Gráfico de líneas con color por dataset ──────────────────────────────
    // datasets: [{ label, data: (number|null)[], color?: string }]
    // labels: string[] en orden cronológico (izq = más antiguo, der = más reciente)
    const drawLineChart = (title, datasets, labels, cx, cy, cw, ch) => {
      const LEFT = 34;
      const BOT  = 20;
      const TITL = 16;
      const TOPP = 4;
      const px0  = cx + LEFT;
      const py0  = cy + TITL + TOPP;
      const pw   = cw - LEFT;
      const ph   = ch - TITL - TOPP - BOT;
      const n    = labels.length;

      // Título
      doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(8)
         .text(title, cx, cy, { width: cw * 0.55, lineBreak: false });

      const allVals = datasets.flatMap(d => d.data).filter(v => v != null && !isNaN(v));
      if (allVals.length < 2) {
        doc.fillColor(C.gray400).font("Helvetica").fontSize(7)
           .text("Sin datos suficientes", px0, py0 + ph / 2 - 5,
             { width: pw, align: "center", lineBreak: false });
        return;
      }

      const rawMin = Math.min(...allVals);
      const rawMax = Math.max(...allVals);
      const pad    = Math.max((rawMax - rawMin) * 0.20, 5);
      const yMin   = rawMin - pad;
      const yMax   = rawMax + pad;
      const yRng   = yMax - yMin;

      const xPos = (i) => px0 + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
      const yPos = (v)  => py0 + ph * (1 - (v - yMin) / yRng);

      // Solo etiquetas del eje Y — sin líneas de cuadrícula ni caja
      for (let g = 0; g <= 3; g++) {
        const gy  = py0 + ph * g / 3;
        const val = yMax - (yRng * g / 3);
        const lbl = Number.isInteger(val) ? String(Math.round(val)) : val.toFixed(1);
        doc.fillColor(C.gray400).font("Helvetica").fontSize(5.5)
           .text(lbl, cx, gy - 3.5, { width: LEFT - 2, align: "right", lineBreak: false });
      }

      // Eje Y — línea vertical izquierda muy sutil
      doc.moveTo(px0, py0).lineTo(px0, py0 + ph)
         .strokeColor(C.gray300).lineWidth(0.5).stroke();

      // Líneas de datos y puntos
      // Cada segmento se dibuja individualmente para evitar acumulación de paths en PDFKit
      datasets.forEach((ds, di) => {
        const color = ds.color ?? (di === 0 ? C.dark : C.gray600);
        const lineW = di === 0 ? 1.5 : 1.2;
        const dotR  = 1.8;

        // Línea: segmento a segmento — cada stroke() limpia el path antes del siguiente
        let prevX = null;
        let prevY = null;
        ds.data.forEach((v, i) => {
          if (v == null || isNaN(v)) { prevX = null; prevY = null; return; }
          const x = xPos(i);
          const y = yPos(v);
          if (prevX !== null) {
            if (di > 0) doc.dash(6, { space: 3 }); else doc.undash();
            doc.moveTo(prevX, prevY).lineTo(x, y)
               .strokeColor(color).lineWidth(lineW).stroke();
          }
          prevX = x;
          prevY = y;
        });
        doc.undash();

        // Puntos: cada círculo es una operación independiente (path limpio antes de cada fill)
        ds.data.forEach((v, i) => {
          if (v == null || isNaN(v)) return;
          doc.circle(xPos(i), yPos(v), dotR).fill(color);
        });
      });

      // Etiquetas del eje X
      const step = Math.max(1, Math.ceil(n / 7));
      labels.forEach((l, i) => {
        if (i % step !== 0 && i !== n - 1) return;
        doc.fillColor(C.gray400).font("Helvetica").fontSize(5.5)
           .text(l, xPos(i) - 18, py0 + ph + 5, { width: 36, align: "center", lineBreak: false });
      });

      // Leyenda — línea y punto por separado para evitar path acumulado
      const LEG_W = 68;
      let lx = cx + cw - datasets.length * LEG_W;
      datasets.forEach((ds, di) => {
        const color = ds.color ?? (di === 0 ? C.dark : C.gray600);
        const lineW = di === 0 ? 1.5 : 1.2;
        const ly    = cy + 1;
        if (di > 0) doc.dash(5, { space: 2 }); else doc.undash();
        doc.moveTo(lx, ly + 5).lineTo(lx + 14, ly + 5)
           .strokeColor(color).lineWidth(lineW).stroke();
        doc.undash();
        doc.circle(lx + 7, ly + 5, 2).fill(color);
        doc.fillColor(C.dark).font("Helvetica").fontSize(6)
           .text(ds.label, lx + 17, ly + 2, { lineBreak: false });
        lx += LEG_W;
      });
    };

    // ── Bloque destacado para datos importantes (alergias, condiciones, contacto)
    const drawSpecialBlock = (label, value) => {
      if (!value) return;
      const PAD   = 10;
      const accW  = 3;
      const textW = CW - PAD * 2 - accW;
      doc.font("Helvetica").fontSize(8);
      const valH   = doc.heightOfString(value, { width: textW });
      const totalH = Math.max(28, 14 + valH + 8);
      if (doc.y + totalH > BOTTOM) { doc.addPage(); drawPageHeader(); }
      const y = doc.y;
      doc.rect(M, y, CW, totalH).fill(C.gray100);
      doc.rect(M, y, accW, totalH).fill(C.charcoal);
      doc.rect(M, y + totalH - 0.5, CW, 0.5).fill(C.gray200);
      doc.fillColor(C.gray400).font("Helvetica").fontSize(5.5)
         .text(label.toUpperCase(), M + PAD, y + 4, { lineBreak: false });
      doc.fillColor(C.gray800).font("Helvetica").fontSize(8)
         .text(value, M + PAD, y + 13, { width: textW });
      doc.y = y + totalH + 4;
    };

    // ── Tabla especializada de signos vitales con encabezados enriquecidos ────
    const drawVitalSignsTable = (sorted) => {
      const colWidths = [60, 100, 75, 75, 70, 125]; // Σ = 505
      const totalW    = colWidths.reduce((a, b) => a + b, 0);
      const HDR_H     = 34;
      const MIN_H     = 15;
      const PAD       = 4;
      const FS        = 7.5;

      const headerDefs = [
        { main: "Fecha",            abbr: "",      unit: "",     ref: "" },
        { main: "Presión Arterial", abbr: "PA",    unit: "mmHg", ref: "Ref: 90–120 / 60–80 mmHg" },
        { main: "Frec. Cardíaca",   abbr: "FC",    unit: "lpm",  ref: "Ref: 60–100 lpm" },
        { main: "Temperatura",      abbr: "Temp.", unit: "°C",   ref: "Ref: 36.0–37.5 °C" },
        { main: "Saturación O₂",    abbr: "SpO₂",  unit: "%",    ref: "Ref: ≥ 95 %" },
        { main: "Peso",             abbr: "",      unit: "kg",   ref: "" },
      ];

      const rows = sorted.map((vs) => [
        fmt(vs.date),
        vs.systolicBP != null && vs.diastolicBP != null
          ? `${vs.systolicBP} / ${vs.diastolicBP}`
          : vs.systolicBP != null ? `${vs.systolicBP} / —` : null,
        vs.heartRate,
        vs.temperature,
        vs.oxygenSaturation,
        vs.weight,
      ]);

      const cellH = (text, ci) => {
        doc.font(ci === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(FS);
        return doc.heightOfString(str(text), { width: colWidths[ci] - PAD * 2 });
      };
      const rowH = (row) => Math.max(MIN_H, ...row.map((cell, ci) => cellH(cell, ci) + 8));

      const renderHeader = () => {
        const y = doc.y;
        doc.rect(M, y, totalW, HDR_H).fill(C.gray200);
        doc.rect(M, y, totalW, 1.5).fill(C.charcoal);
        let x = M;
        headerDefs.forEach((h, i) => {
          const w = colWidths[i];
          if (i === 0) {
            doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7)
               .text("FECHA", x + PAD, y + HDR_H / 2 - 4,
                 { width: w - PAD * 2, lineBreak: false });
          } else {
            doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7)
               .text(h.main, x + PAD, y + 4,
                 { width: w - PAD * 2, lineBreak: false, ellipsis: true });
            const abbrUnit = [h.abbr, h.unit].filter(Boolean).join(" · ");
            if (abbrUnit) {
              doc.fillColor(C.charcoal).font("Helvetica").fontSize(6)
                 .text(abbrUnit, x + PAD, y + 13,
                   { width: w - PAD * 2, lineBreak: false, ellipsis: true });
            }
            if (h.ref) {
              doc.fillColor(C.gray400).font("Helvetica").fontSize(5.5)
                 .text(h.ref, x + PAD, y + 22,
                   { width: w - PAD * 2, lineBreak: false, ellipsis: true });
            }
          }
          if (i > 0) {
            doc.rect(x, y + 1.5, 0.5, HDR_H - 1.5).fill(C.gray300);
          }
          x += w;
        });
        doc.y = y + HDR_H;
      };

      if (doc.y > BOTTOM - 55) { doc.addPage(); drawPageHeader(); }
      renderHeader();

      rows.forEach((row, ri) => {
        const rh = rowH(row);
        if (doc.y + rh > BOTTOM) { doc.addPage(); drawPageHeader(); renderHeader(); }
        const rowY = doc.y;
        if (ri % 2 === 1) doc.rect(M, rowY, totalW, rh).fill(C.gray50);
        doc.rect(M, rowY + rh - 0.5, totalW, 0.5).fill(C.gray300);
        let cx = M;
        row.forEach((cell, ci) => {
          doc.fillColor(ci === 0 ? C.gray800 : C.gray600)
             .font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
             .fontSize(FS)
             .text(str(cell), cx + PAD, rowY + 4,
               { width: colWidths[ci] - PAD * 2 });
          cx += colWidths[ci];
        });
        doc.y = rowY + rh;
      });
      doc.y += 5;
    };

    // ── Sub-nota debajo de tabla (para notes de signos vitales / vacunas) ─────
    const drawSubNote = (prefix, text) => {
      if (!text) return;
      if (doc.y > BOTTOM - 22) { doc.addPage(); drawPageHeader(); }
      doc.fillColor(C.gray400).font("Helvetica").fontSize(6.5)
         .text(prefix, M + 4, doc.y, { continued: true, lineBreak: false });
      doc.fillColor(C.gray600)
         .text(text, { width: CW - 8 });
      doc.y += 2;
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  INICIO DEL DOCUMENTO
    // ══════════════════════════════════════════════════════════════════════════
    drawPageHeader();

    const pat = record.patient || {};

    // ── Bloque de identidad ───────────────────────────────────────────────────
    const titleY = doc.y;
    doc.rect(M, titleY, CW, 48).fill(C.white);
    doc.rect(M, titleY, CW, 48).stroke(C.gray300);
    doc.rect(M, titleY, 4, 48).fill(C.charcoal);

    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(15)
       .text("HISTORIAL CLÍNICO", M + 14, titleY + 5,
         { width: CW - 20, lineBreak: false });
    doc.fillColor(C.gray800).font("Helvetica-Bold").fontSize(9.5)
       .text(fullNm(pat), M + 14, titleY + 24,
         { width: CW - 20, lineBreak: false, ellipsis: true });
    doc.fillColor(C.gray600).font("Helvetica").fontSize(7)
       .text(
         `SUS: ${str(pat.susCode)}   ·   Estado: ${(record.state || "activo").toUpperCase()}   ·   Apertura: ${fmt(record.createdAt)}`,
         M + 14, titleY + 37, { width: CW - 20, lineBreak: false });

    doc.y = titleY + 55;

    // ── Datos del paciente ────────────────────────────────────────────────────
    sectionTitle("Datos del paciente");

    const age = pat.dateOfBirth
      ? `${Math.floor((Date.now() - new Date(pat.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))} años`
      : null;

    const patFields = [
      { label: "Nombre completo",     value: fullNm(pat),              span: 2 },
      { label: "Código SUS",          value: pat.susCode,              span: 1 },
      { label: "Género",              value: pat.gender,               span: 1 },
      { label: "Fecha de nacimiento", value: fmt(pat.dateOfBirth),     span: 1 },
      { label: "Edad",                value: age,                      span: 1 },
      { label: "Teléfono",            value: pat.contactInfo?.phone,   span: 1 },
      { label: "Correo electrónico",  value: pat.email,                span: 1 },
      { label: "Dirección",           value: pat.contactInfo?.address, span: 2 },
      { label: "Centro de salud",     value: pat.healthCenter?.name,   span: 2 },
    ];

    drawDataGrid(patFields, 4);

    if (pat.allergies?.filter(Boolean).length)
      drawSpecialBlock("Alergias conocidas", pat.allergies.filter(Boolean).join("   ·   "));

    if (pat.medicalConditions?.filter(Boolean).length)
      drawSpecialBlock("Condiciones médicas previas", pat.medicalConditions.filter(Boolean).join("   ·   "));

    if (pat.emergencyContact?.name) {
      const ec    = pat.emergencyContact;
      const ecTxt = [
        ec.name,
        ec.relationship ? `(${ec.relationship})` : null,
        ec.phone        ? `Tel: ${ec.phone}`      : null,
      ].filter(Boolean).join("   ·   ");
      drawSpecialBlock("Contacto de emergencia", ecTxt);
    }

    // ── Signos vitales ────────────────────────────────────────────────────────
    if (record.vitalSigns?.length) {
      const sorted = [...record.vitalSigns].sort((a, b) => new Date(b.date) - new Date(a.date));
      sectionTitle("Signos vitales", sorted.length);

      drawVitalSignsTable(sorted);

      sorted.forEach((vs, idx) => {
        if (vs.notes) drawSubNote(`Obs. ${idx + 1} (${fmt(vs.date)}): `, vs.notes);
      });

      // ── Gráficos de evolución (solo si hay ≥ 2 tomas) ─────────────────────
      if (sorted.length >= 2) {
        // Para el gráfico el orden debe ser cronológico (izq = más antiguo)
        const chrono = [...sorted].reverse();
        const labels = chrono.map(vs => dayjs(vs.date).format("DD/MM/YY"));
        const hasData = (field, min = 2) =>
          chrono.filter(vs => vs[field] != null && !isNaN(vs[field])).length >= min;

        const charts = [];
        if (chrono.some(vs => vs.systolicBP != null || vs.diastolicBP != null))
          charts.push({
            title: "Presión Arterial (mmHg)",
            datasets: [
              { label: "Sistólica",  data: chrono.map(vs => vs.systolicBP),  color: "#B91C1C" },
              { label: "Diastólica", data: chrono.map(vs => vs.diastolicBP), color: "#1D4ED8" },
            ],
          });
        if (hasData("weight"))
          charts.push({ title: "Peso (kg)",          datasets: [{ label: "Peso",  data: chrono.map(vs => vs.weight),           color: "#15803D" }] });
        if (hasData("oxygenSaturation"))
          charts.push({ title: "Saturación O₂ (%)", datasets: [{ label: "SpO₂", data: chrono.map(vs => vs.oxygenSaturation), color: "#0E7490" }] });

        if (charts.length) {
          const HALF_W  = (CW - 8) / 2;
          const CHART_H = 130;

          for (let r = 0; r < charts.length; r += 2) {
            if (doc.y + CHART_H + 10 > BOTTOM) { doc.addPage(); drawPageHeader(); }
            const rowY   = doc.y;
            const hasPair = charts[r + 1] !== undefined;
            // Si va solo en su fila → ancho completo; si hay par → mitad
            const w = hasPair ? HALF_W : CW;
            drawLineChart(charts[r].title, charts[r].datasets, labels, M, rowY, w, CHART_H);
            if (hasPair)
              drawLineChart(charts[r + 1].title, charts[r + 1].datasets, labels, M + HALF_W + 8, rowY, HALF_W, CHART_H);
            doc.y = rowY + CHART_H + 8;
          }
          doc.y += 4;
        }
      }
    }

    // ── Diagnósticos ──────────────────────────────────────────────────────────
    if (record.diagnoses?.length) {
      sectionTitle("Diagnósticos", record.diagnoses.length);

      const dHeaders = ["Fecha", "CIE-10", "Descripción del diagnóstico", "Notas clínicas", "Médico responsable"];
      const dColW    = [52, 46, 140, 140, 127]; // Σ = 505

      const dRows = record.diagnoses.map((d) => [
        fmt(d.date), d.code, d.description, d.notes,
        d.doctor?.name ? `Dr. ${d.doctor.name}` : userNm(d.createdBy),
      ]);
      drawTable(dHeaders, dRows, dColW);
    }

    // ── Medicaciones prescritas ───────────────────────────────────────────────
    if (record.medications?.length) {
      sectionTitle("Medicaciones prescritas", record.medications.length);

      const mHeaders = ["Medicamento", "Dosis", "Inicio", "Fin", "Prescrito por"];
      const mColW    = [155, 95, 55, 55, 145]; // Σ = 505

      const mRows = record.medications.map((m) => [
        m.name, m.dose, fmt(m.start), fmt(m.end), userNm(m.createdBy),
      ]);
      drawTable(mHeaders, mRows, mColW);
    }

    // ── Historial de alergias ─────────────────────────────────────────────────
    if (record.allergyHistory?.length) {
      sectionTitle("Historial de alergias", record.allergyHistory.length);

      const aHeaders = ["Sustancia / Alérgeno", "Reacción observada", "Fecha", "Registrado por"];
      const aColW    = [150, 200, 55, 100]; // Σ = 505

      const aRows = record.allergyHistory.map((a) => [
        a.substance, a.reaction, fmt(a.date), userNm(a.createdBy),
      ]);
      drawTable(aHeaders, aRows, aColW);
    }

    // ── Tratamientos previos ──────────────────────────────────────────────────
    if (record.previousTreatments?.length) {
      sectionTitle("Tratamientos previos", record.previousTreatments.length);

      const tHeaders = ["Tratamiento / Procedimiento", "Desde", "Hasta", "Registrado por"];
      const tColW    = [220, 65, 65, 155]; // Σ = 505

      const tRows = record.previousTreatments.map((t) => [
        t.treatment, fmt(t.from), fmt(t.to), userNm(t.createdBy),
      ]);
      drawTable(tHeaders, tRows, tColW);
    }

    // ── Registro de vacunación ────────────────────────────────────────────────
    if (record.vaccines?.length) {
      sectionTitle("Registro de vacunación", record.vaccines.length);

      const vHeaders = ["Vacuna / Inmunobiológico", "Dosis / Refuerzo", "N.º Lote", "Fecha", "Aplicado por"];
      const vColW    = [165, 85, 70, 55, 130]; // Σ = 505

      const vRows = record.vaccines.map((v) => [
        v.name, v.doseNumber, v.lot, fmt(v.date), v.appliedBy,
      ]);
      drawTable(vHeaders, vRows, vColW);

      record.vaccines.forEach((v) => {
        if (v.notes) drawSubNote(`Obs. (${v.name}): `, v.notes);
      });
    }

    // ── Evolución y observaciones clínicas ────────────────────────────────────
    if (record.observations?.length) {
      sectionTitle("Evolución y observaciones clínicas", record.observations.length);

      record.observations.forEach((o, idx) => {
        if (doc.y > BOTTOM - 38) { doc.addPage(); drawPageHeader(); }

        const obY  = doc.y;
        const meta = [`#${idx + 1}`, fmt(o.date), o.createdBy ? `— ${userNm(o.createdBy)}` : null]
          .filter(Boolean).join("  ");

        doc.rect(M, obY, CW, 13).fill(C.gray100);
        doc.rect(M, obY, 3, 13).fill(C.charcoal);
        doc.fillColor(C.gray600).font("Helvetica").fontSize(6.5)
           .text(meta, M + 8, obY + 3.5, { width: CW - 12, lineBreak: false, ellipsis: true });
        doc.y = obY + 15;

        doc.fillColor(C.gray800).font("Helvetica").fontSize(8)
           .text(o.note || "—", M + 8, doc.y, { width: CW - 16 });
        doc.y += 5;
      });
      doc.y += 2;
    }

    // ── Citas médicas vinculadas ──────────────────────────────────────────────
    if (record.medicalAppointments?.length) {
      const sortedApts = [...record.medicalAppointments]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      sectionTitle("Citas médicas vinculadas", sortedApts.length);

      const aptHeaders = ["Fecha", "Hora", "Médico", "Servicio", "Estado"];
      const aptColW    = [60, 45, 130, 190, 80]; // Σ = 505

      const aptRows = sortedApts.map((a) => [
        fmt(a.date), a.time,
        a.doctor?.name ? `Dr. ${a.doctor.name}` : "—",
        a.services?.[0]?.name,
        a.state,
      ]);
      drawTable(aptHeaders, aptRows, aptColW);
    }

    // ── Bloque de firmas ──────────────────────────────────────────────────────
    if (doc.y > BOTTOM - 100) { doc.addPage(); drawPageHeader(); }
    doc.y += 14;

    const sigY = doc.y;
    doc.rect(M, sigY, CW, 0.5).fill(C.gray300);
    doc.y = sigY + 8;

    doc.fillColor(C.gray400).font("Helvetica").fontSize(6.5)
       .text(
         "Documento generado por SIGMED-PA — G.A.M.P.A. La Paz, Bolivia. Válido como registro oficial del historial clínico del paciente.",
         M, doc.y, { width: CW, align: "center" });
    doc.y += 12;

    const sigW  = CW / 3;
    const lineY = doc.y + 36;
    ["Médico responsable", "Sello del establecimiento", "Firma del paciente / tutor"].forEach((label, i) => {
      const sx = M + i * sigW + 12;
      const sw = sigW - 24;
      doc.rect(sx, lineY, sw, 0.7).fill(C.gray400);
      doc.fillColor(C.gray600).font("Helvetica").fontSize(7)
         .text(label, sx, lineY + 5, { width: sw, align: "center", lineBreak: false });
    });
    doc.y = lineY + 20;

    doc.end();
  });
