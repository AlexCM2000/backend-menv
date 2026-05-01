import HealthRecord from "../models/HealthRecord.js";
import Patient from "../models/Patient.js";
import Health from "../models/HealthCenter.js";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { crearAuditLog } from "../utils/auditHelper.js";
import mongoose from "mongoose";
import paginate from "../utils/pagination.js";
import dayjs from "dayjs";

const isMongoObjectId = (value) =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

/** Acceso de escritura clínica: admin, branchManager, doctor */
const canWriteClinical = (user) =>
  user?.admin || user?.branchManager || user?.doctor;

/** Gestión administrativa: solo admin y branchManager */
const canManage = (user) => user?.admin || user?.branchManager;

/**
 * GET /health-records
 * Listado paginado. Acceso: admin, branchManager, doctor
 * Query params: page, page_size, search, state, health (admin), archived (true/false)
 */
export const getHealthRecords = async (req, res) => {
  try {
    if (!req.user || !canWriteClinical(req.user)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const search = req.query.search;
    const state = req.query.state;
    const showArchived = req.query.archived === "true";
    const date_from = req.query.date_from;
    const date_to = req.query.date_to;

    // Por defecto solo muestra no archivados, salvo que se pida explícitamente
    const filter = showArchived ? { archivedAt: { $ne: null } } : { archivedAt: null };

    if (state && ["activo", "cerrado", "en tratamiento"].includes(state)) {
      filter.state = state;
    }

    if (date_from || date_to) {
      filter.createdAt = {};
      if (date_from) filter.createdAt.$gte = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Excluir historiales vinculados a usuarios staff por user ID, email o susCode
    const staffUsers = await User.find({
      $or: [{ admin: true }, { doctor: true }, { branchManager: true }],
    }).select("_id email susCode").lean();

    const _excludeConds = [];
    const _sIds    = staffUsers.map(u => u._id);
    const _sEmails = staffUsers.map(u => u.email).filter(Boolean);
    const _sSus    = staffUsers.map(u => u.susCode).filter(Boolean);
    if (_sIds.length)    _excludeConds.push({ user:    { $in: _sIds } });
    if (_sEmails.length) _excludeConds.push({ email:   { $in: _sEmails } });
    if (_sSus.length)    _excludeConds.push({ susCode: { $in: _sSus } });

    const staffPatientIds = _excludeConds.length
      ? (await Patient.find({ $or: _excludeConds, eliminado_en: null }).select("_id").lean()).map(p => p._id)
      : [];

    let patientFilter = { eliminado_en: null };
    if (staffPatientIds.length) patientFilter._id = { $nin: staffPatientIds };

    let needsPatientLookup = false;

    // Filtro de centro de salud según rol
    if (req.user.admin) {
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: Number(req.query.health) };
        const hc = await Health.findOne(hcQuery);
        if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });
        patientFilter.healthCenter = hc._id;
        needsPatientLookup = true;
      }
    } else if (req.user.branchManager || req.user.doctor) {
      patientFilter.healthCenter = req.user.health;
      needsPatientLookup = true;
    }

    if (search) {
      patientFilter.$or = [
        { primerApellido: { $regex: search, $options: "i" } },
        { segundoApellido: { $regex: search, $options: "i" } },
        { nombres: { $regex: search, $options: "i" } },
        { susCode: { $regex: search, $options: "i" } },
      ];
      needsPatientLookup = true;
    }

    if (needsPatientLookup) {
      const matchingPatients = await Patient.find(patientFilter).select("_id");
      const patientIds = matchingPatients.map((p) => p._id);
      if (patientIds.length === 0) {
        return res.json({ count: 0, page, page_size: pageSize, results: [] });
      }
      filter.patient = { $in: patientIds };
    } else if (staffPatientIds.length) {
      // Sin lookup (admin sin filtros): excluir pacientes staff directamente
      filter.patient = { $nin: staffPatientIds };
    }

    const paginated = await paginate(HealthRecord, page, pageSize, filter, [
      {
        path: "patient",
        select: "primerApellido segundoApellido nombres susCode healthCenter",
        populate: { path: "healthCenter", select: "name codigo" },
      },
      { path: "medicalAppointments", select: "date state" },
    ]);

    paginated.results = paginated.results.map((r) => ({
      ...r.toObject(),
      createdAt: dayjs(r.createdAt).format("DD/MM/YYYY HH:mm:ss"),
      updatedAt: dayjs(r.updatedAt).format("DD/MM/YYYY HH:mm:ss"),
    }));

    return res.json(paginated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /health-records
 * Crear historial. Acceso: admin, branchManager.
 * Valida que no exista historial (activo o archivado) para el mismo paciente.
 */
export const createHealthRecord = async (req, res) => {
  try {
    if (!canManage(req.user)) {
      return res.status(403).json({ message: "Solo admin y supervisor pueden crear historiales." });
    }

    const {
      patient: patientId,
      diagnoses = [],
      previousTreatments = [],
      medications = [],
      allergyHistory = [],
      observations = [],
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "ID de paciente no válido." });
    }

    const patient = await Patient.findById(patientId).populate("user");
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado." });
    }

    // Verificar si existe historial (activo o archivado)
    const existing = await HealthRecord.findOne({ patient: patientId });
    if (existing) {
      if (existing.archivedAt) {
        return res.status(400).json({
          message: "El paciente tiene un historial archivado. Desarchívalo antes de crear uno nuevo.",
          existingId: existing._id,
        });
      }
      return res.status(400).json({ message: "El paciente ya tiene un historial médico activo." });
    }

    const record = new HealthRecord({ patient: patientId });

    // Vincular citas existentes: por user (si tiene cuenta) y por patient (citas sin cuenta)
    const apptConditions = [];
    if (patient.user) apptConditions.push({ user: patient.user._id });
    apptConditions.push({ patient: patient._id });
    const appts = await Appointment.find({ $or: apptConditions }).select("_id");
    if (appts.length) {
      record.medicalAppointments = appts.map((a) => a._id);
    }

    const userId = req.user._id;
    diagnoses.forEach((d) => record.diagnoses.push({ ...d, createdBy: userId }));
    previousTreatments.forEach((t) => record.previousTreatments.push({ ...t, createdBy: userId }));
    medications.forEach((m) => record.medications.push({ ...m, createdBy: userId }));
    allergyHistory.forEach((a) => record.allergyHistory.push({ ...a, createdBy: userId }));
    observations.forEach((o) => record.observations.push({ ...o, createdBy: userId }));

    await record.save();

    // Vincular el historial al paciente si no tiene uno
    if (!patient.medicalHistory) {
      patient.medicalHistory = record._id;
      await patient.save();
    }

    return res.status(201).json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al crear historial." });
  }
};

/**
 * GET /health-records/:id
 * Detalle completo. Acceso: admin, branchManager, doctor
 */
export const getHealthRecord = async (req, res) => {
  try {
    if (!req.user || !canWriteClinical(req.user)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }

    const record = await HealthRecord.findById(id)
      .populate("patient", "primerApellido segundoApellido nombres susCode dateOfBirth gender contactInfo emergencyContact medicalConditions allergies")
      .populate({
        path: "medicalAppointments",
        select: "date time state services doctor notes",
        populate: [
          { path: "services", select: "name category" },
          { path: "doctor", select: "name specialty" },
        ],
      })
      .populate("diagnoses.createdBy", "primerApellido segundoApellido nombres")
      .populate("diagnoses.doctor", "name specialty")
      .populate("observations.createdBy", "primerApellido segundoApellido nombres")
      .populate("observations.doctor", "name specialty")
      .populate("medications.createdBy", "primerApellido segundoApellido nombres")
      .populate("previousTreatments.createdBy", "primerApellido segundoApellido nombres")
      .populate("allergyHistory.createdBy", "primerApellido segundoApellido nombres");

    if (!record) return res.status(404).json({ message: "No encontrado." });

    return res.json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener historial." });
  }
};

/**
 * GET /health-records/by-appointment/:appointmentId
 * Obtiene el ID del historial del paciente asociado a una cita.
 * Acceso: admin, branchManager, doctor
 */
export const getHealthRecordByAppointment = async (req, res) => {
  try {
    if (!req.user || !canWriteClinical(req.user)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const { appointmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "ID de cita no válido." });
    }

    const appointment = await Appointment.findById(appointmentId).select("user patient");
    if (!appointment) return res.status(404).json({ message: "Cita no encontrada." });

    let patient = null;

    if (appointment.patient) {
      // Cita creada para paciente sin cuenta: referencia directa
      patient = await Patient.findById(appointment.patient).select("medicalHistory");
    } else if (appointment.user) {
      // Cita creada por usuario con cuenta: buscar paciente por susCode
      const apptUser = await User.findById(appointment.user).select("susCode");
      if (apptUser?.susCode) {
        patient = await Patient.findOne({ susCode: apptUser.susCode, eliminado_en: null }).select("medicalHistory");
      }
    }

    if (!patient?.medicalHistory) {
      return res.status(404).json({ message: "El paciente no tiene historial médico registrado." });
    }

    return res.json({ healthRecordId: patient.medicalHistory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener historial por cita." });
  }
};

/**
 * Factory para agregar subdocumentos al historial.
 * Acceso: admin, branchManager, doctor
 * Doctor auto-inyecta su doctorProfile en diagnoses y observations.
 */
const addSubdoc = (field) => async (req, res) => {
  try {
    if (!canWriteClinical(req.user)) {
      return res.status(403).json({ message: "No autorizado para agregar entradas clínicas." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }

    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });

    if (record.archivedAt) {
      return res.status(400).json({ message: "No se puede agregar entradas a un historial archivado." });
    }

    const userId = req.user._id;
    const entry = {
      ...req.body,
      date: req.body.date || Date.now(),
      createdBy: userId,
    };

    // Auto-inyectar doctorProfile en campos que lo soportan
    if (req.user.doctor && req.user.doctorProfile && (field === "diagnoses" || field === "observations")) {
      entry.doctor = req.user.doctorProfile;
    }

    record[field].push(entry);
    await record.save();
    return res.status(201).json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al agregar entrada." });
  }
};

export const addObservation = addSubdoc("observations");
export const addDiagnosis = addSubdoc("diagnoses");
export const addPreviousTreatment = addSubdoc("previousTreatments");
export const addMedication = addSubdoc("medications");
export const addAllergy = addSubdoc("allergyHistory");

/**
 * PATCH /health-records/:id/state
 * Cambiar estado del historial. Acceso: admin, branchManager, doctor
 */
export const updateRecordState = async (req, res) => {
  try {
    if (!canWriteClinical(req.user)) {
      return res.status(403).json({ message: "No autorizado para cambiar estado." });
    }

    const { id } = req.params;
    const { state } = req.body;

    if (!["activo", "en tratamiento", "cerrado"].includes(state)) {
      return res.status(400).json({ message: "Estado no válido. Use: activo, en tratamiento, cerrado." });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }

    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });

    if (record.archivedAt) {
      return res.status(400).json({ message: "No se puede cambiar estado de un historial archivado." });
    }

    const previousState = record.state;
    record.state = state;
    await record.save();

    crearAuditLog({
      action:      "health_record_state_change",
      performedBy: req.user,
      targetId:    record._id,
      description: `Cambio de estado del historial: "${previousState}" → "${state}"`,
      details: {
        "Estado anterior": previousState,
        "Estado nuevo":    state,
        "ID historial":    record._id.toString(),
        "ID paciente":     record.patient?.toString() ?? "—",
      },
      ip: req.ip,
    });

    return res.json({ message: "Estado actualizado.", state: record.state });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar estado." });
  }
};

/**
 * DELETE /health-records/:id
 * Archivar historial. Acceso: solo admin y branchManager
 */
export const archiveRecord = async (req, res) => {
  try {
    if (!canManage(req.user)) {
      return res.status(403).json({ message: "Solo admin y supervisor pueden archivar historiales." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }

    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });

    if (record.archivedAt) {
      return res.status(400).json({ message: "El historial ya está archivado." });
    }

    record.archivedAt = Date.now();
    await record.save();
    return res.json({ message: "Historial archivado correctamente." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al archivar historial." });
  }
};

/**
 * PATCH /health-records/:id/unarchive
 * Desarchivar historial. Acceso: solo admin y branchManager
 */
export const unarchiveHealthRecord = async (req, res) => {
  try {
    if (!canManage(req.user)) {
      return res.status(403).json({ message: "Solo admin y supervisor pueden desarchivar historiales." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "Historial no encontrado." });

    if (!record.archivedAt) {
      return res.status(400).json({ message: "El historial ya está activo." });
    }

    record.archivedAt = null;
    await record.save();
    return res.status(200).json({ message: "Historial desarchivado correctamente." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};