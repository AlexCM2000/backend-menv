import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js"
dayjs.extend(utc);
import Appointment from "../../models/Appointment.js";
import HealthRecord from "../../models/HealthRecord.js";
import Health from "../../models/HealthCenter.js";
import Patient from "../../models/Patient.js";
import User from "../../models/User.js";
import Doctor from "../../models/Doctor.js";
import Services from "../../models/Services.js";
import Category from "../../models/Category.js";
import { buildExcel, buildPDF } from "../../utils/reportService.js";

const isMongoObjectId = (v) =>
  typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);

/** Calcula edad en años a partir de fecha de nacimiento */
const calcAge = (dob) => {
  if (!dob) return "—";
  return `${dayjs().diff(dayjs.utc(dob), "year")} años`;
};

/** Formatea moneda boliviana */
const formatBs = (amount) =>
  amount != null ? `Bs. ${Number(amount).toFixed(2)}` : "—";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Decide format from query param, defaults to xlsx */
const getFormat = (req) =>
  req.query.format === "pdf" ? "pdf" : "xlsx";

/** Send the generated file as a download */
const sendFile = (res, buffer, format, filename) => {
  if (format === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  } else {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  }
  res.end(buffer);
};

/** Lookup health center by ObjectId or code, return { id, name } or null */
const resolveHealth = async (value) => {
  if (!value) return null;
  const q = isMongoObjectId(value) ? { _id: value } : { codigo: value };
  return Health.findOne(q).select("_id name");
};

/** Build filter description string */
const buildFilterDesc = (parts) =>
  parts.filter(Boolean).join("  |  ") || "Sin filtros";

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT CITAS MÉDICAS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportAppointments = async (req, res) => {
  try {
    if (!req.user)
      return res.status(403).json({ message: "No autorizado" });

    const format = getFormat(req);
    const { search, state, date_from, date_to } = req.query;

    // ── Construir query (igual que userController) ──────────────────────────
    let query = {};
    let healthName = null;

    if (req.user.admin) {
      if (req.query.health) {
        const hc = await resolveHealth(req.query.health);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        query.health = hc._id;
        healthName = hc.name;
      }
      if (search) {
        const users = await User.find({
          $or: [
            { primerApellido: { $regex: search, $options: "i" } },
            { segundoApellido: { $regex: search, $options: "i" } },
            { nombres:  { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }).select("_id");
        const ids = users.map((u) => u._id);
        if (!ids.length) return sendFile(res, await buildEmptyExcel("Citas médicas", format), format, "citas_medicas");
        query.user = { $in: ids };
      }
    } else if (req.user.branchManager) {
      query.health = req.user.health;
      if (search) {
        const users = await User.find({
          $or: [
            { primerApellido: { $regex: search, $options: "i" } },
            { segundoApellido: { $regex: search, $options: "i" } },
            { nombres:  { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }).select("_id");
        const ids = users.map((u) => u._id);
        if (!ids.length) return sendFile(res, await buildEmptyExcel("Citas médicas", format), format, "citas_medicas");
        query.user = { $in: ids };
      }
    } else {
      query = { user: req.user._id, date: { $gte: new Date() } };
    }

    const validStates = ["Pendiente", "Reprogramada", "Cancelada", "Completada", "No asistio"];
    if (state && validStates.includes(state)) query.state = state;

    if (req.user.admin || req.user.branchManager) {
      if (date_from || date_to) {
        query.date = {};
        if (date_from) query.date.$gte = new Date(date_from);
        if (date_to) {
          const end = new Date(date_to);
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }
    }

    // ── Fetch ALL records ───────────────────────────────────────────────────
    const appointments = await Appointment.find(query)
      .populate("services", "name category")
      .populate("health", "name")
      .populate("user", "primerApellido segundoApellido nombres email")
      .populate("doctor", "name specialty")
      .sort({ date: -1 })
      .lean();

    // ── Columnas según formato ───────────────────────────────────────────────
    const isStaff = req.user.admin || req.user.branchManager;
    const pdfColumns = [
      { label: "N°",            key: "num",      width: 4  },
      { label: "Servicio",      key: "servicio", width: 20 },
      { label: "Fecha",         key: "fecha",    width: 11 },
      { label: "Hora",          key: "hora",     width: 8  },
      ...(isStaff ? [{ label: "Paciente", key: "paciente", width: 18 }] : []),
      { label: "Médico",        key: "medico",   width: 18 },
      { label: "Centro médico", key: "centro",   width: 16 },
      { label: "Estado",        key: "estado",   width: 13 },
      { label: "Total (Bs.)",   key: "total",    width: 10 },
    ];
    const xlsxColumns = [
      { label: "N°",            key: "num",       excelWidth: 5  },
      { label: "Servicio",      key: "servicio",  excelWidth: 25 },
      { label: "Categoría",     key: "categoria", excelWidth: 18 },
      { label: "Fecha",         key: "fecha",     excelWidth: 13 },
      { label: "Hora",          key: "hora",      excelWidth: 10 },
      ...(isStaff
        ? [
            { label: "Paciente", key: "paciente", excelWidth: 25 },
            { label: "Email",    key: "email",    excelWidth: 28 },
          ]
        : []),
      { label: "Médico",        key: "medico",    excelWidth: 22 },
      { label: "Especialidad",  key: "especialidad", excelWidth: 20 },
      { label: "Centro médico", key: "centro",    excelWidth: 22 },
      { label: "Estado",        key: "estado",    excelWidth: 14 },
      { label: "Total (Bs.)",   key: "total",     excelWidth: 12 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const totalRevenue = appointments.reduce((s, a) => s + (a.totalAmount || 0), 0);

    const rows = appointments.map((a, i) => ({
      num:          i + 1,
      servicio:     a.services?.[0]?.name ?? "—",
      categoria:    a.services?.[0]?.category ?? "—",
      fecha:        a.date ? dayjs(a.date).format("DD/MM/YYYY") : "—",
      hora:         a.time ?? "—",
      paciente:     [a.user?.primerApellido, a.user?.segundoApellido, a.user?.nombres].filter(Boolean).join(" ") || "—",
      email:        a.user?.email ?? "—",
      medico:       a.doctor?.name ?? "Sin asignar",
      especialidad: a.doctor?.specialty ?? "—",
      centro:       a.health?.name ?? "—",
      estado:       a.state ?? "—",
      total:        formatBs(a.totalAmount),
    }));

    // ── Resumen ─────────────────────────────────────────────────────────────
    const summary = [
      "Pendiente", "Completada", "Reprogramada", "Cancelada", "No asistio",
    ].flatMap((s) => {
      const count = rows.filter((r) => r.estado === s).length;
      return count > 0 ? [{ label: s, value: count }] : [];
    });
    summary.push({ label: "Total recaudado", value: formatBs(totalRevenue) });

    // ── Filtros aplicados ───────────────────────────────────────────────────
    const filters = buildFilterDesc([
      search       && `Búsqueda: "${search}"`,
      state        && `Estado: ${state}`,
      date_from    && `Desde: ${dayjs(date_from).format("DD/MM/YYYY")}`,
      date_to      && `Hasta: ${dayjs(date_to).format("DD/MM/YYYY")}`,
      healthName   && `Centro: ${healthName}`,
    ]);

    // ── Generar y enviar ────────────────────────────────────────────────────
    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Citas Médicas", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Citas Médicas", filters, columns, rows, summary });

    const dateStr = dayjs().format("YYYY-MM-DD");
    sendFile(res, buffer, format, `citas_medicas_${dateStr}`);
  } catch (err) {
    console.error("exportAppointments:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT PACIENTES
// ═══════════════════════════════════════════════════════════════════════════════
export const exportPatients = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });

    const format = getFormat(req);
    const { search, gender } = req.query;

    const query = { eliminado_en: null };
    let healthName = null;

    if (req.user.admin) {
      if (req.query.health) {
        const hc = await resolveHealth(req.query.health);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        query.healthCenter = hc._id;
        healthName = hc.name;
      }
    } else if (req.user.branchManager) {
      query.healthCenter = req.user.health;
    } else {
      return res.status(403).json({ message: "No autorizado" });
    }

    if (gender && ["Masculino", "Femenino"].includes(gender)) query.gender = gender;

    if (search) {
      query.$or = [
        { primerApellido: { $regex: search, $options: "i" } },
        { segundoApellido: { $regex: search, $options: "i" } },
        { nombres:   { $regex: search, $options: "i" } },
        { email:     { $regex: search, $options: "i" } },
        { susCode:   { $regex: search, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query)
      .populate("healthCenter", "name")
      .sort({ createdAt: -1 })
      .lean();

    const pdfColumns = [
      { label: "N°",              key: "num",            width: 4  },
      { label: "Nombre completo", key: "nombre_completo",width: 22 },
      { label: "Cód. SUS",        key: "sus",            width: 12 },
      { label: "Género",          key: "genero",         width: 10 },
      { label: "Edad",            key: "edad",           width: 9  },
      { label: "Teléfono",        key: "telefono",       width: 13 },
      { label: "Centro de salud", key: "centro",         width: 20 },
      { label: "Fecha registro",  key: "registro",       width: 13 },
    ];
    const xlsxColumns = [
      { label: "N°",                    key: "num",            excelWidth: 5  },
      { label: "Nombre",                key: "nombre",         excelWidth: 18 },
      { label: "Apellido",              key: "apellido",       excelWidth: 18 },
      { label: "Email",                 key: "email",          excelWidth: 26 },
      { label: "Cód. SUS",              key: "sus",            excelWidth: 13 },
      { label: "Género",                key: "genero",         excelWidth: 11 },
      { label: "Edad",                  key: "edad",           excelWidth: 10 },
      { label: "F. Nacimiento",         key: "nacimiento",     excelWidth: 14 },
      { label: "Teléfono",              key: "telefono",       excelWidth: 14 },
      { label: "Centro de salud",       key: "centro",         excelWidth: 22 },
      { label: "Condiciones médicas",   key: "condiciones",    excelWidth: 28 },
      { label: "Alergias",              key: "alergias",       excelWidth: 22 },
      { label: "Cont. emergencia",      key: "emerg_nombre",   excelWidth: 20 },
      { label: "Tel. emergencia",       key: "emerg_telefono", excelWidth: 16 },
      { label: "Parentesco",            key: "emerg_relacion", excelWidth: 14 },
      { label: "Fecha registro",        key: "registro",       excelWidth: 15 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const rows = patients.map((p, i) => ({
      num:            i + 1,
      nombre_completo:[p.primerApellido, p.segundoApellido, p.nombres].filter(Boolean).join(" ") || "—",
      nombre:         p.nombres                                ?? "—",
      apellido:       [p.primerApellido, p.segundoApellido].filter(Boolean).join(" ") || "—",
      email:          p.email                                  ?? "—",
      sus:            p.susCode                                ?? "—",
      genero:         p.gender                                 ?? "—",
      edad:           calcAge(p.dateOfBirth),
      nacimiento:     p.dateOfBirth ? dayjs.utc(p.dateOfBirth).format("DD/MM/YYYY") : "—",
      telefono:       p.contactInfo?.phone                     ?? "—",
      centro:         p.healthCenter?.name                     ?? "—",
      condiciones:    p.medicalConditions?.filter(Boolean).join(", ") || "Ninguna",
      alergias:       p.allergies?.filter(Boolean).join(", ")         || "Ninguna",
      emerg_nombre:   p.emergencyContact?.name                 ?? "—",
      emerg_telefono: p.emergencyContact?.phone                ?? "—",
      emerg_relacion: p.emergencyContact?.relationship         ?? "—",
      registro:       p.createdAt ? dayjs(p.createdAt).format("DD/MM/YYYY") : "—",
    }));

    const summary = [
      { label: "Total Masculino", value: rows.filter((r) => r.genero === "Masculino").length },
      { label: "Total Femenino",  value: rows.filter((r) => r.genero === "Femenino").length  },
    ].filter((s) => s.value > 0);

    const filters = buildFilterDesc([
      search     && `Búsqueda: "${search}"`,
      gender     && `Género: ${gender}`,
      healthName && `Centro: ${healthName}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Pacientes", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Pacientes", filters, columns, rows, summary });

    sendFile(res, buffer, format, `pacientes_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportPatients:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT HISTORIALES MÉDICOS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportHealthRecords = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });

    const format = getFormat(req);
    const { search, state, date_from, date_to } = req.query;

    const filter = { archivedAt: null };
    let patientFilter = { eliminado_en: null };
    let needsLookup = false;
    let healthName = null;

    if (req.user.admin) {
      if (req.query.health) {
        const hc = await resolveHealth(req.query.health);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        patientFilter.healthCenter = hc._id;
        healthName = hc.name;
        needsLookup = true;
      }
    } else if (req.user.branchManager) {
      patientFilter.healthCenter = req.user.health;
      needsLookup = true;
    } else {
      return res.status(403).json({ message: "No autorizado" });
    }

    if (state && ["activo", "cerrado", "en tratamiento"].includes(state)) filter.state = state;

    if (date_from || date_to) {
      filter.createdAt = {};
      if (date_from) filter.createdAt.$gte = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      patientFilter.$or = [
        { primerApellido: { $regex: search, $options: "i" } },
        { segundoApellido: { $regex: search, $options: "i" } },
        { nombres:   { $regex: search, $options: "i" } },
        { susCode:   { $regex: search, $options: "i" } },
      ];
      needsLookup = true;
    }

    if (needsLookup) {
      const matched = await Patient.find(patientFilter).select("_id").lean();
      if (!matched.length) {
        const empty = format === "pdf"
          ? await buildPDF({ title: "Reporte de Historiales", filters: "Sin resultados", columns: [], rows: [], summary: [] })
          : await buildExcel({ title: "Reporte de Historiales", filters: "Sin resultados", columns: [], rows: [], summary: [] });
        return sendFile(res, empty, format, `historiales_${dayjs().format("YYYY-MM-DD")}`);
      }
      filter.patient = { $in: matched.map((p) => p._id) };
    }

    const records = await HealthRecord.find(filter)
      .populate({
        path: "patient",
        select: "primerApellido segundoApellido nombres susCode email gender dateOfBirth contactInfo healthCenter",
        populate: { path: "healthCenter", select: "name" },
      })
      .sort({ createdAt: -1 })
      .lean();

    const pdfColumns = [
      { label: "N°",              key: "num",      width: 4  },
      { label: "Paciente",        key: "paciente", width: 20 },
      { label: "Cód. SUS",        key: "sus",      width: 12 },
      { label: "Género",          key: "genero",   width: 10 },
      { label: "Centro de salud", key: "centro",   width: 18 },
      { label: "Estado",          key: "estado",   width: 14 },
      { label: "Diagnósticos",    key: "num_diag", width: 11 },
      { label: "Medicaciones",    key: "num_meds", width: 11 },
      { label: "Fecha creación",  key: "creado",   width: 13 },
    ];
    const xlsxColumns = [
      { label: "N°",                  key: "num",         excelWidth: 5  },
      { label: "Paciente",            key: "paciente",    excelWidth: 22 },
      { label: "Cód. SUS",            key: "sus",         excelWidth: 13 },
      { label: "Género",              key: "genero",      excelWidth: 11 },
      { label: "Edad",                key: "edad",        excelWidth: 10 },
      { label: "Teléfono",            key: "telefono",    excelWidth: 14 },
      { label: "Centro de salud",     key: "centro",      excelWidth: 22 },
      { label: "Estado",              key: "estado",      excelWidth: 15 },
      { label: "N° Diagnósticos",     key: "num_diag",    excelWidth: 13 },
      { label: "N° Medicaciones",     key: "num_meds",    excelWidth: 13 },
      { label: "N° Tratamientos",     key: "num_tratos",  excelWidth: 13 },
      { label: "N° Alergias",         key: "num_alerg",   excelWidth: 11 },
      { label: "Último diagnóstico",  key: "ult_diag",    excelWidth: 30 },
      { label: "Fecha creación",      key: "creado",      excelWidth: 16 },
      { label: "Últ. actualización",  key: "actualizado", excelWidth: 17 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const rows = records.map((r, i) => {
      const lastDiag = r.diagnoses?.length
        ? r.diagnoses[r.diagnoses.length - 1]
        : null;
      return {
        num:         i + 1,
        paciente:    [r.patient?.primerApellido, r.patient?.segundoApellido, r.patient?.nombres].filter(Boolean).join(" ") || "—",
        sus:         r.patient?.susCode                          ?? "—",
        genero:      r.patient?.gender                           ?? "—",
        edad:        calcAge(r.patient?.dateOfBirth),
        telefono:    r.patient?.contactInfo?.phone               ?? "—",
        centro:      r.patient?.healthCenter?.name               ?? "—",
        estado:      r.state ? r.state.charAt(0).toUpperCase() + r.state.slice(1) : "—",
        num_diag:    r.diagnoses?.length            ?? 0,
        num_meds:    r.medications?.length          ?? 0,
        num_tratos:  r.previousTreatments?.length   ?? 0,
        num_alerg:   r.allergyHistory?.length        ?? 0,
        ult_diag:    lastDiag
          ? `[${lastDiag.code ?? ""}] ${lastDiag.description ?? ""}`.trim()
          : "Sin diagnósticos",
        creado:      r.createdAt ? dayjs(r.createdAt).format("DD/MM/YYYY") : "—",
        actualizado: r.updatedAt ? dayjs(r.updatedAt).format("DD/MM/YYYY") : "—",
      };
    });

    const summary = ["Activo", "En tratamiento", "Cerrado"].flatMap((s) => {
      const count = rows.filter((r) => r.estado.toLowerCase() === s.toLowerCase()).length;
      return count > 0 ? [{ label: s, value: count }] : [];
    });
    summary.push({ label: "Total diagnósticos registrados", value: rows.reduce((s, r) => s + r.num_diag, 0) });
    summary.push({ label: "Total medicaciones activas",     value: rows.reduce((s, r) => s + r.num_meds, 0) });

    const filters = buildFilterDesc([
      search     && `Búsqueda: "${search}"`,
      state      && `Estado: ${state}`,
      date_from  && `Desde: ${dayjs(date_from).format("DD/MM/YYYY")}`,
      date_to    && `Hasta: ${dayjs(date_to).format("DD/MM/YYYY")}`,
      healthName && `Centro: ${healthName}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Historiales Médicos", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Historiales Médicos", filters, columns, rows, summary });

    sendFile(res, buffer, format, `historiales_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportHealthRecords:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT MÉDICOS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportDoctors = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });
    const isStaff = req.user.admin || req.user.branchManager;
    if (!isStaff) return res.status(403).json({ message: "Solo administradores y supervisores" });

    const format = getFormat(req);
    const { search, specialty, active } = req.query;

    const query = {};
    let healthName = null;

    if (req.user.admin) {
      if (req.query.health) {
        const hc = await resolveHealth(req.query.health);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        query.health = hc._id;
        healthName = hc.name;
      }
    } else {
      query.health = req.user.health;
    }

    if (search) {
      query.$or = [
        { name:          { $regex: search, $options: "i" } },
        { specialty:     { $regex: search, $options: "i" } },
        { licenseNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (specialty) query.specialty = specialty;
    if (active === "true")  query.active = true;
    else if (active === "false") query.active = false;

    const doctors = await Doctor.find(query)
      .populate("health", "name")
      .sort({ name: 1 })
      .lean();

    const pdfColumns = [
      { label: "N°",              key: "num",         width: 4  },
      { label: "Nombre",          key: "nombre",      width: 22 },
      { label: "Especialidad",    key: "especialidad",width: 18 },
      { label: "Nº Licencia",     key: "licencia",    width: 14 },
      { label: "Teléfono",        key: "telefono",    width: 12 },
      { label: "Centro de salud", key: "centro",      width: 18 },
      { label: "Estado",          key: "estado",      width: 10 },
    ];
    const xlsxColumns = [
      { label: "N°",              key: "num",         excelWidth: 5  },
      { label: "Nombre",          key: "nombre",      excelWidth: 25 },
      { label: "Especialidad",    key: "especialidad",excelWidth: 20 },
      { label: "Nº Licencia",     key: "licencia",    excelWidth: 16 },
      { label: "Email",           key: "email",       excelWidth: 26 },
      { label: "Teléfono",        key: "telefono",    excelWidth: 14 },
      { label: "Experiencia",     key: "experiencia", excelWidth: 12 },
      { label: "Centro de salud", key: "centro",      excelWidth: 22 },
      { label: "Estado",          key: "estado",      excelWidth: 11 },
      { label: "Fecha registro",  key: "registro",    excelWidth: 16 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const rows = doctors.map((d, i) => ({
      num:         i + 1,
      nombre:      d.name                              ?? "—",
      especialidad:d.specialty                         ?? "—",
      licencia:    d.licenseNumber                     ?? "—",
      email:       d.contactInfo?.email                ?? "—",
      telefono:    d.contactInfo?.phone                ?? "—",
      experiencia: d.yearsOfExperience != null ? `${d.yearsOfExperience} años` : "—",
      centro:      d.health?.name                      ?? "—",
      estado:      d.active ? "Activo" : "Inactivo",
      registro:    d.createdAt ? dayjs(d.createdAt).format("DD/MM/YYYY") : "—",
    }));

    const summary = [
      { label: "Total activos",   value: rows.filter((r) => r.estado === "Activo").length   },
      { label: "Total inactivos", value: rows.filter((r) => r.estado === "Inactivo").length },
    ].filter((s) => s.value > 0);

    const filters = buildFilterDesc([
      search    && `Búsqueda: "${search}"`,
      specialty && `Especialidad: ${specialty}`,
      active != null && active !== "" && `Estado: ${active === "true" ? "Activo" : "Inactivo"}`,
      healthName && `Centro: ${healthName}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Médicos", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Médicos", filters, columns, rows, summary });

    sendFile(res, buffer, format, `medicos_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportDoctors:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT SERVICIOS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportServices = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });
    const isStaff = req.user.admin || req.user.branchManager;
    if (!isStaff) return res.status(403).json({ message: "Solo administradores y supervisores" });

    const format = getFormat(req);
    const { search, category } = req.query;

    const query = {};
    if (search)   query.name     = { $regex: search, $options: "i" };
    if (category) query.category = category;

    const services = await Services.find(query).sort({ category: 1, name: 1 }).lean();

    const pdfColumns = [
      { label: "N°",           key: "num",       width: 4  },
      { label: "Servicio",     key: "nombre",    width: 30 },
      { label: "Categoría",    key: "categoria", width: 22 },
      { label: "Precio (Bs.)", key: "precio",    width: 13 },
    ];
    const xlsxColumns = [
      { label: "N°",           key: "num",       excelWidth: 5  },
      { label: "Servicio",     key: "nombre",    excelWidth: 30 },
      { label: "Categoría",    key: "categoria", excelWidth: 22 },
      { label: "Precio (Bs.)", key: "precio",    excelWidth: 14 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const rows = services.map((s, i) => ({
      num:       i + 1,
      nombre:    s.name     ?? "—",
      categoria: s.category ?? "—",
      precio:    formatBs(s.price),
    }));

    const summary = [
      { label: "Total servicios", value: rows.length },
    ];

    const filters = buildFilterDesc([
      search   && `Búsqueda: "${search}"`,
      category && `Categoría: ${category}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Servicios", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Servicios", filters, columns, rows, summary });

    sendFile(res, buffer, format, `servicios_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportServices:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportCategories = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });
    const isStaff = req.user.admin || req.user.branchManager;
    if (!isStaff) return res.status(403).json({ message: "Solo administradores y supervisores" });

    const format = getFormat(req);
    const { search, active } = req.query;

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (active === "true")  query.active = true;
    else if (active === "false") query.active = false;

    const categories = await Category.find(query).sort({ name: 1 }).lean();

    const pdfColumns = [
      { label: "N°",          key: "num",         width: 4  },
      { label: "Nombre",      key: "nombre",      width: 22 },
      { label: "Descripción", key: "descripcion", width: 37 },
      { label: "Estado",      key: "estado",      width: 10 },
    ];
    const xlsxColumns = [
      { label: "N°",             key: "num",         excelWidth: 5  },
      { label: "Nombre",         key: "nombre",      excelWidth: 22 },
      { label: "Descripción",    key: "descripcion", excelWidth: 38 },
      { label: "Icono",          key: "icono",       excelWidth: 20 },
      { label: "Estado",         key: "estado",      excelWidth: 12 },
      { label: "Fecha creación", key: "registro",    excelWidth: 16 },
    ];
    const columns = format === "pdf" ? pdfColumns : xlsxColumns;

    const rows = categories.map((c, i) => ({
      num:         i + 1,
      nombre:      c.name        ?? "—",
      descripcion: c.description || "—",
      icono:       c.icon        ?? "—",
      estado:      c.active ? "Activa" : "Inactiva",
      registro:    c.createdAt ? dayjs(c.createdAt).format("DD/MM/YYYY") : "—",
    }));

    const summary = [
      { label: "Total activas",   value: rows.filter((r) => r.estado === "Activa").length   },
      { label: "Total inactivas", value: rows.filter((r) => r.estado === "Inactiva").length },
    ].filter((s) => s.value > 0);

    const filters = buildFilterDesc([
      search && `Búsqueda: "${search}"`,
      active != null && active !== "" && `Estado: ${active === "true" ? "Activa" : "Inactiva"}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Categorías", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Categorías", filters, columns, rows, summary });

    sendFile(res, buffer, format, `categorias_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportCategories:", err);
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════
export const exportUsers = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });
    if (!req.user.admin && !req.user.branchManager)
      return res.status(403).json({ message: "Solo administradores y supervisores" });

    const format = getFormat(req);
    const { search, role, verified } = req.query;

    const query = {};
    let healthName = null;

    if (req.user.admin) {
      if (req.query.health) {
        const hc = await resolveHealth(req.query.health);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        query.health = hc._id;
        healthName = hc.name;
      }
    } else {
      query.health = req.user.health;
    }

    if (search) {
      query.$or = [
        { primerApellido: { $regex: search, $options: "i" } },
        { segundoApellido: { $regex: search, $options: "i" } },
        { nombres:  { $regex: search, $options: "i" } },
        { email:   { $regex: search, $options: "i" } },
        { susCode: { $regex: search, $options: "i" } },
      ];
    }

    if (role === "admin")         { query.admin = true; }
    else if (role === "branchManager") { query.branchManager = true; query.admin = { $ne: true }; }
    else if (role === "user")     { query.admin = { $ne: true }; query.branchManager = { $ne: true }; }

    if (verified === "true")  query.verified = true;
    else if (verified === "false") query.verified = false;

    const users = await User.find(query)
      .populate("health", "name")
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const getRol = (u) => {
      if (u.admin) return "Administrador";
      if (u.branchManager) return "Supervisor";
      return "Usuario";
    };

    const columns = [
      { label: "N°",              key: "num",       width: 4,  excelWidth: 5  },
      { label: "Nombre",          key: "nombre",    width: 20, excelWidth: 24 },
      { label: "Email",           key: "email",     width: 24, excelWidth: 28 },
      { label: "Cód. SUS",        key: "sus",       width: 12, excelWidth: 14 },
      { label: "Rol",             key: "rol",       width: 14, excelWidth: 16 },
      { label: "Verificado",      key: "verificado",width: 10, excelWidth: 12 },
      { label: "Centro de salud", key: "centro",    width: 20, excelWidth: 24 },
      { label: "Fecha registro",  key: "registro",  width: 14, excelWidth: 18 },
    ];

    const rows = users.map((u, i) => ({
      num:        i + 1,
      nombre:     [u.primerApellido, u.segundoApellido, u.nombres].filter(Boolean).join(" ") || "—",
      email:      u.email     ?? "—",
      sus:        u.susCode   ?? "—",
      rol:        getRol(u),
      verificado: u.verified  ? "Sí" : "No",
      centro:     u.health?.name ?? "—",
      registro:   u.createdAt ? dayjs(u.createdAt).format("DD/MM/YYYY") : "—",
    }));

    const summary = [
      { label: "Administradores",    value: rows.filter((r) => r.rol === "Administrador").length },
      { label: "Supervisores",       value: rows.filter((r) => r.rol === "Supervisor").length    },
      { label: "Usuarios",           value: rows.filter((r) => r.rol === "Usuario").length       },
      { label: "Verificados",        value: rows.filter((r) => r.verificado === "Sí").length     },
      { label: "No verificados",     value: rows.filter((r) => r.verificado === "No").length     },
    ].filter((s) => s.value > 0);

    const verifiedLabel =
      verified === "true" ? "Verificado: Sí" :
      verified === "false" ? "Verificado: No" : null;

    const roleLabels = { admin: "Administrador", branchManager: "Supervisor", user: "Usuario" };

    const filters = buildFilterDesc([
      search        && `Búsqueda: "${search}"`,
      role          && `Rol: ${roleLabels[role] ?? role}`,
      verifiedLabel,
      healthName    && `Centro: ${healthName}`,
    ]);

    const buffer = format === "pdf"
      ? await buildPDF({ title: "Reporte de Usuarios", filters, columns, rows, summary })
      : await buildExcel({ title: "Reporte de Usuarios", filters, columns, rows, summary });

    sendFile(res, buffer, format, `usuarios_${dayjs().format("YYYY-MM-DD")}`);
  } catch (err) {
    console.error("exportUsers:", err);
    res.status(500).json({ message: err.message });
  }
};
