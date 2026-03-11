import Patient from "../../models/Patient.js";
import Health from "../../models/HealthCenter.js";
import Sus from "../../models/Sus.js";
import User from "../../models/User.js";
import dayjs from "dayjs";
import Appointment from "../../models/Appointment.js";
import paginate from "../../utils/pagination.js";
import mongoose from "mongoose";
import { populate } from "dotenv";

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

    const query = { eliminado_en: null };

    // Filtro por centro de salud según rol
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
        query.healthCenter = hc._id;
      }
    } else if (req.user.branchManager) {
      if (!req.user.health)
        return res
          .status(400)
          .json({ message: "Branch manager sin centro asignado." });
      query.healthCenter = req.user.health;
    }

    // Filtro de género
    if (gender && ["Masculino", "Femenino"].includes(gender)) {
      query.gender = gender;
    }

    // Búsqueda por texto (nombre, apellido, email, código SUS)
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { susCode: { $regex: search, $options: "i" } },
      ];
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
      firstName,
      lastName,
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
    if (
      !firstName ||
      !lastName ||
      !dateOfBirth ||
      !gender ||
      !healthCenter ||
      !susCode
    ) {
      return res.status(400).json({
        message: "Todos los campos obligatorios deben estar completos.",
      });
    }

    // 2) Verificar centro de salud
    const existingHealthCenter = await Health.findOne({ codigo: healthCenter });
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
      firstName,
      lastName,
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
      firstName,
      lastName,
      dateOfBirth,
      gender,
      email,
      contactInfo,
      emergencyContact,
      medicalConditions = [],
      allergies = [],
      healthCenter, // ESTE es tu código (string o número)
      susCode,
    } = req.body;

    // 3) Buscar paciente existente
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // 4) Si enviaron un nuevo healthCenter, validarlo y asignarlo
    if (healthCenter) {
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
    patient.firstName = firstName ?? patient.firstName;
    patient.lastName = lastName ?? patient.lastName;
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

    // Buscar el paciente
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Realizar soft delete: asignar la fecha actual a 'eliminado_en'
    patient.eliminado_en = new Date();
    await patient.save();

    res.status(200).json({ message: "Paciente eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar el paciente:", error);
    res.status(500).json({ message: "Error al eliminar el paciente." });
  }
};

export { getPatients, createPatient, updatePatient, deletePatient };
