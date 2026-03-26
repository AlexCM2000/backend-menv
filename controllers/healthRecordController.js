import HealthRecord from "../models/HealthRecord.js";
import Patient from "../models/Patient.js";
import Health from "../models/HealthCenter.js";
import Appointment from "../models/Appointment.js";
import mongoose from "mongoose";
import paginate from "../utils/pagination.js";
import dayjs from "dayjs";

const isMongoObjectId = (value) =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

/**
 * Listado paginado de historiales médicos
 */
export const getHealthRecords = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const search = req.query.search;
    const state = req.query.state;

    const filter = { archivedAt: null };

    // Filtro por estado del historial
    if (state && ["activo", "cerrado", "en tratamiento"].includes(state)) {
      filter.state = state;
    }

    // Filtro por centro de salud y/o búsqueda (a través del paciente)
    let patientFilter = { eliminado_en: null };
    let needsPatientLookup = false;

    if (req.user) {
      if (req.user.admin) {
        if (req.query.health) {
          const hcQuery = isMongoObjectId(req.query.health)
            ? { _id: req.query.health }
            : { codigo: req.query.health };
          const hc = await Health.findOne(hcQuery);
          if (!hc)
            return res
              .status(404)
              .json({ message: "Centro de salud no encontrado." });
          patientFilter.healthCenter = hc._id;
          needsPatientLookup = true;
        }
      } else if (req.user.branchManager) {
        patientFilter.healthCenter = req.user.health;
        needsPatientLookup = true;
      }
    }

    // Búsqueda por nombre o código SUS del paciente
    if (search) {
      patientFilter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
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
    }

    const paginated = await paginate(HealthRecord, page, pageSize, filter, [
      { path: "patient", select: "firstName lastName susCode" },
      { path: "medicalAppointments", select: "date status" },
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
 * Crear historial médico (vacío o con datos iniciales)
 * - Toma subdocumentos iniciales de req.body
 * - Asigna createdBy desde req.user._id
 */
export const createHealthRecord = async (req, res) => {
  try {
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

    // 🔧 Poblar el campo `user` del paciente
    const patient = await Patient.findById(patientId).populate("user");
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado." });
    }

    if (await HealthRecord.findOne({ patient: patientId })) {
      return res.status(400).json({ message: "Historial ya existe." });
    }

    const record = new HealthRecord({ patient: patientId });

    // ✅ Agregar citas existentes si el paciente tiene un usuario asignado
    if (patient.user) {
      const appts = await Appointment.find({ user: patient.user._id }).select(
        "_id"
      );
      if (appts.length) {
        record.medicalAppointments = appts.map((a) => a._id);
      }
    }

    const userId = req.user._id;

    // Subdocumentos con creadoPor
    diagnoses.forEach((d) =>
      record.diagnoses.push({ ...d, createdBy: userId })
    );
    previousTreatments.forEach((t) =>
      record.previousTreatments.push({ ...t, createdBy: userId })
    );
    medications.forEach((m) =>
      record.medications.push({ ...m, createdBy: userId })
    );
    allergyHistory.forEach((a) =>
      record.allergyHistory.push({ ...a, createdBy: userId })
    );
    observations.forEach((o) =>
      record.observations.push({ ...o, createdBy: userId })
    );

    await record.save();
    return res.status(201).json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al crear historial." });
  }
};

/**
 * Obtener un historial por id
 */
export const getHealthRecord = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }
    const record = await HealthRecord.findById(id)
      .populate("patient", "firstName lastName susCode dateOfBirth gender contactInfo")
      .populate("medicalAppointments")
      .populate("diagnoses.createdBy", "name")
      .populate("diagnoses.doctor", "name specialty")
      .populate("observations.createdBy", "name")
      .populate("observations.doctor", "name specialty");
    if (!record) return res.status(404).json({ message: "No encontrado." });
    return res.json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener historial." });
  }
};

// Función auxiliar para añadir subdocumentos después
const addSubdoc = (field) => async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }
    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });

    const userId = req.user._id;
    const entry = {
      ...req.body,
      date: req.body.date || Date.now(),
      createdBy: userId,
    };
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
 * Cambiar estado del historial
 */
export const updateRecordState = async (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }
    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });
    record.state = state;
    await record.save();
    return res.json(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar estado." });
  }
};

/**
 * Archivar historial (soft-delete)
 */
export const archiveRecord = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID no válido." });
    }
    const record = await HealthRecord.findById(id);
    if (!record) return res.status(404).json({ message: "No encontrado." });
    record.archivedAt = Date.now();
    await record.save();
    return res.json({ message: "Historial archivado." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al archivar historial." });
  }
};

//desarchivar historial
export const unarchiveHealthRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID inválido." });
    }

    const record = await HealthRecord.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Historial no encontrado." });
    }

    if (!record.archivedAt) {
      return res.status(400).json({ message: "El historial ya está activo." });
    }

    record.archivedAt = null;
    await record.save();

    return res.status(200).json({ message: "Historial desarchivado.", record });
  } catch (error) {
    console.error("Error al desarchivar historial:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};
