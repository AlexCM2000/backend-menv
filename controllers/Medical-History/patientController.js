import Patient from "../../models/Patient.js";
import Health from "../../models/HealthCenter.js";
import Sus from "../../models/Sus.js";
import User from "../../models/User.js";
import HealthRecord from "../../models/HealthRecord.js";
import AuditLog from "../../models/AuditLog.js";
import { crearAuditLog } from "../../utils/auditHelper.js";
import dayjs from "dayjs";
import Appointment from "../../models/Appointment.js";
import paginate from "../../utils/pagination.js";
import mongoose from "mongoose";

const isMongoObjectId = (value) =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

const getPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const search = req.query.search;
    const gender = req.query.gender;

    if (!req.user) {
      return res.status(403).json({ message: "No autorizado" });
    }

    // Excluir pacientes vinculados a usuarios staff por user ID, email o susCode
    const staffUsers = await User.find({
      $or: [{ admin: true }, { doctor: true }, { branchManager: true }],
    }).select("_id email susCode").lean();

    const excludeConditions = [];
    const _sIds  = staffUsers.map(u => u._id);
    const _sEmails  = staffUsers.map(u => u.email).filter(Boolean);
    const _sSus  = staffUsers.map(u => u.susCode).filter(Boolean);
    if (_sIds.length)    excludeConditions.push({ user:    { $in: _sIds } });
    if (_sEmails.length) excludeConditions.push({ email:   { $in: _sEmails } });
    if (_sSus.length)    excludeConditions.push({ susCode: { $in: _sSus } });

    let _excludedPatientIds = [];
    if (excludeConditions.length) {
      const sp = await Patient.find({ $or: excludeConditions, eliminado_en: null }).select("_id").lean();
      _excludedPatientIds = sp.map(p => p._id);
    }

    const query = { eliminado_en: null };
    if (_excludedPatientIds.length) query._id = { $nin: _excludedPatientIds };

    // Filtro por centro de salud según rol
    if (req.user.admin) {
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: Number(req.query.health) };
        const hc = await Health.findOne(hcQuery);
        if (!hc)
          return res
            .status(404)
            .json({ message: "Centro de salud no encontrado." });
        query.healthCenter = hc._id;
      }
    } else if (req.user.branchManager || req.user.doctor) {
      if (!req.user.health)
        return res
          .status(400)
          .json({ message: "Usuario sin centro de salud asignado." });
      query.healthCenter = req.user.health;
    }

    // Filtro de género
    if (gender && ["Masculino", "Femenino"].includes(gender)) {
      query.gender = gender;
    }

    // Búsqueda flexible por texto (apellidos, nombres, email, código SUS)
    // Soporta búsquedas multi-palabra: "alex churata" encuentra "Alex Churata Mamaniy"
    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      const buildTokenCondition = (token) => ({
        $or: [
          { primerApellido: { $regex: token, $options: "i" } },
          { segundoApellido: { $regex: token, $options: "i" } },
          { nombres: { $regex: token, $options: "i" } },
          { email: { $regex: token, $options: "i" } },
          { susCode: { $regex: token, $options: "i" } },
        ],
      });
      if (tokens.length === 1) {
        query.$or = buildTokenCondition(tokens[0]).$or;
      } else {
        query.$and = tokens.map(buildTokenCondition);
      }
    }

    const paginatedPatients = await paginate(
      Patient,
      page,
      pageSize,
      query,
      "healthCenter"
    );

    paginatedPatients.results = paginatedPatients.results.map((patient) => ({
      ...patient.toObject(),
      createdAt: dayjs(patient.createdAt).format("DD/MM/YYYY HH:mm:ss"),
      updatedAt: dayjs(patient.updatedAt).format("DD/MM/YYYY HH:mm:ss"),
    }));

    return res.status(200).json(paginatedPatients);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Controlador para crear un nuevo paciente
const createPatient = async (req, res) => {
  try {
    const {
      primerApellido,
      segundoApellido,
      nombres,
      dateOfBirth,
      gender,
      email,
      contactInfo,
      emergencyContact,
      medicalConditions = [],
      allergies = [],
      healthCenter,
      susCode,
    } = req.body;

    // 1) Campos obligatorios
    const isBranchManagerOnly = !req.user.admin && req.user.branchManager;
    if (
      !primerApellido ||
      !nombres ||
      !dateOfBirth ||
      !gender ||
      (!isBranchManagerOnly && !healthCenter) ||
      !susCode
    ) {
      return res.status(400).json({
        message: "Todos los campos obligatorios deben estar completos.",
      });
    }

    // 1b) Fecha de nacimiento no puede ser futura
    const dob = new Date(dateOfBirth);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (dob > todayMidnight) {
      return res.status(400).json({ message: "La fecha de nacimiento no puede ser una fecha futura." });
    }

    // 2) Verificar centro de salud
    // Para branchManager (con o sin admin): usar su centro asignado desde el token (ignora el body)
    let existingHealthCenter;
    if (req.user.branchManager && req.user.health) {
      existingHealthCenter = await Health.findById(req.user.health);
    } else if (isBranchManagerOnly) {
      return res.status(400).json({ message: "No tienes un centro de salud asignado." });
    } else {
      const codigoNum = Number(healthCenter);
      if (isNaN(codigoNum)) {
        return res.status(400).json({ message: "Código de centro de salud inválido." });
      }
      existingHealthCenter = await Health.findOne({ codigo: codigoNum });
    }
    if (!existingHealthCenter) {
      return res
        .status(404)
        .json({ message: "El centro de salud proporcionado no existe." });
    }

    // 3) Verificar email único
    if (email) {
      const emailUser = await Patient.findOne({ email, eliminado_en: null });
      if (emailUser) {
        return res
          .status(400)
          .json({ message: "El email ingresado ya existe." });
      }
    }

    // 4) Verificar que el SUS existe
    const existingSus = await Sus.findOne({ codigo: susCode });
    if (!existingSus) {
      return res.status(404).json({ message: "Código SUS no existe." });
    }

    // 5) Verificar que ningún paciente ya tenga ese susCode
    const existingPatientWithSus = await Patient.findOne({
      susCode,
      eliminado_en: null,
    });
    if (existingPatientWithSus) {
      return res.status(400).json({
        message: "El código SUS ya está registrado en otro paciente.",
      });
    }

    // 6) Intentar obtener el usuario y sus citas (pero no es bloqueante)
    const user = await User.findOne({ susCode });
    let appointments = [];
    if (user) {
      const relatedAppointments = await Appointment.find({ user: user._id });
      appointments = relatedAppointments.map((a) => a._id);
    }
    // 8) Crear el paciente
    const newPatient = new Patient({
      primerApellido,
      segundoApellido: segundoApellido || "",
      nombres,
      dateOfBirth,
      gender,
      contactInfo,
      emergencyContact,
      medicalConditions: Array.isArray(medicalConditions)
        ? medicalConditions
        : [medicalConditions],
      allergies: Array.isArray(allergies) ? allergies : [allergies],
      healthCenter: existingHealthCenter._id,
      susCode,
      user: user?._id || null,
      email,
      appointments,
    });

    const savedPatient = await newPatient.save();

    // Auto-crear historial clínico (no bloqueante)
    try {
      const healthRecord = new HealthRecord({ patient: savedPatient._id });
      const savedRecord = await healthRecord.save();
      savedPatient.medicalHistory = savedRecord._id;
      await savedPatient.save();
    } catch (hrErr) {
      console.error("Error al crear historial automático:", hrErr);
    }

    return res
      .status(201)
      .json({ message: "Paciente creado con éxito", patient: savedPatient });
  } catch (error) {
    console.error("Error al crear el paciente:", error);
    return res.status(500).json({ message: "Error al crear el paciente" });
  }
};

const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    // 1) Verificar ID de paciente válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de paciente no válido" });
    }

    // 2) Extraer datos del body
    const {
      primerApellido,
      segundoApellido,
      nombres,
      dateOfBirth,
      gender,
      email,
      contactInfo,
      emergencyContact,
      medicalConditions = [],
      allergies = [],
      healthCenter,
      susCode,
    } = req.body;

    // 3) Buscar paciente existente
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // 3b) Fecha de nacimiento no puede ser futura
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (dob > todayMidnight) {
        return res.status(400).json({ message: "La fecha de nacimiento no puede ser una fecha futura." });
      }
    }

    // 4) Si enviaron un nuevo healthCenter, validarlo y asignarlo
    // Para branchManager: ignorar el valor del body, mantener el centro actual
    const isBranchManagerOnlyUpd = !req.user.admin && req.user.branchManager;
    if (!isBranchManagerOnlyUpd && healthCenter) {
      // Busca el centro por su campo 'codigo'
      const hcDoc = await Health.findOne({ codigo: healthCenter });
      if (!hcDoc) {
        return res.status(404).json({
          message: "El centro de salud proporcionado no existe.",
        });
      }
      // Asigna YA EL ObjectId, y NO lo toques otra vez
      patient.healthCenter = hcDoc._id;
    }

    // 5) Validar email si lo cambiaron
    if (email && email !== patient.email) {
      const emailUser = await Patient.findOne({
        email,
        _id: { $ne: id },
      });
      if (emailUser) {
        return res
          .status(400)
          .json({ message: "El email ingresado ya está en uso." });
      }
      patient.email = email;
    }

    // 4) Verificar que el SUS existe
    const existingSus = await Sus.findOne({ codigo: susCode });
    if (!existingSus) {
      return res.status(404).json({ message: "Código SUS no existe." });
    }
    if (susCode && susCode !== patient.susCode) {
      const dupSus = await Patient.findOne({
        susCode,
        _id: { $ne: id },
        eliminado_en: null,
      });
      if (dupSus) {
        return res.status(400).json({
          message: "El código SUS ya está registrado en otro paciente.",
        });
      }
      patient.susCode = susCode;
    }

    // 7) Actualizar el resto de campos
    patient.primerApellido = primerApellido ?? patient.primerApellido;
    patient.segundoApellido = segundoApellido !== undefined ? segundoApellido : patient.segundoApellido;
    patient.nombres = nombres ?? patient.nombres;
    patient.dateOfBirth = dateOfBirth ?? patient.dateOfBirth;
    patient.gender = gender ?? patient.gender;
    patient.contactInfo = contactInfo ?? patient.contactInfo;
    patient.emergencyContact = emergencyContact ?? patient.emergencyContact;
    patient.medicalConditions = Array.isArray(medicalConditions)
      ? medicalConditions
      : [medicalConditions];
    patient.allergies = Array.isArray(allergies) ? allergies : [allergies];

    // 8) Guardar cambios
    const updatedPatient = await patient.save();
    return res.status(200).json({
      message: "Paciente actualizado con éxito",
      patient: updatedPatient,
    });
  } catch (error) {
    console.error("Error al actualizar el paciente:", error);
    return res.status(500).json({ message: "Error al actualizar el paciente" });
  }
};

const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el ID sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de paciente no válido" });
    }

    // Buscar el paciente con centro de salud populado para el log
    const patient = await Patient.findById(id).populate("healthCenter", "name");
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Realizar soft delete: asignar la fecha actual a 'eliminado_en'
    patient.eliminado_en = new Date();
    await patient.save();

    const nombrePaciente = [patient.primerApellido, patient.segundoApellido, patient.nombres]
      .filter(Boolean).join(" ");

    crearAuditLog({
      action:      "patient_delete",
      performedBy: req.user,
      targetId:    patient._id,
      description: `Paciente eliminado: ${nombrePaciente}`,
      details: {
        "Nombre completo":  nombrePaciente,
        "Código SUS":       patient.susCode,
        "Centro de salud":  patient.healthCenter?.name ?? "—",
      },
      ip: req.ip,
    });

    res.status(200).json({ message: "Paciente eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar el paciente:", error);
    res.status(500).json({ message: "Error al eliminar el paciente." });
  }
};

export { getPatients, createPatient, updatePatient, deletePatient };
