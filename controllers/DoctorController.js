import Doctor from "../models/Doctor.js";
import HealthCenter from "../models/HealthCenter.js";
import paginate from "../utils/pagination.js";
import mongoose from "mongoose";
import dayjs from "dayjs";

const isMongoObjectId = (value) =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

/**
 * GET /api/doctors
 * Listado paginado con filtros: search, specialty, active, health
 * Acceso: admin (todos), branchManager (su centro)
 */
const getDoctors = async (req, res) => {
  try {
    if (!req.user.admin && !req.user.branchManager) {
      return res.status(403).json({ msg: "No tienes permisos para ver esta información." });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const search = req.query.search;
    const specialty = req.query.specialty;
    const active = req.query.active;

    const filter = {};

    if (active === "true") filter.active = true;
    else if (active === "false") filter.active = false;

    if (specialty) filter.specialty = specialty;

    if (req.user.admin) {
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: Number(req.query.health) };
        const hc = await HealthCenter.findOne(hcQuery);
        if (!hc) return res.status(404).json({ msg: "Centro de salud no encontrado." });
        filter.health = hc._id;
      }
    } else if (req.user.branchManager) {
      filter.health = req.user.health;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialty: { $regex: search, $options: "i" } },
        { licenseNumber: { $regex: search, $options: "i" } },
      ];
    }

    const paginated = await paginate(Doctor, page, pageSize, filter, "health");

    paginated.results = paginated.results.map((d) => ({
      ...d.toObject(),
      createdAt: dayjs(d.createdAt).format("DD/MM/YYYY HH:mm:ss"),
      updatedAt: dayjs(d.updatedAt).format("DD/MM/YYYY HH:mm:ss"),
    }));

    return res.json(paginated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: error.message });
  }
};

/**
 * GET /api/doctors/select
 * Lista simple de médicos activos para usar en selectores/dropdowns.
 * Filtra por el centro de salud del usuario autenticado (o por query ?health para admin).
 */
const getDoctorsForSelect = async (req, res) => {
  try {
    const filter = { active: true };

    if (req.user.admin) {
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: Number(req.query.health) };
        const hc = await HealthCenter.findOne(hcQuery);
        if (hc) filter.health = hc._id;
      }
    } else {
      filter.health = req.user.health;
    }

    if (req.query.specialty) filter.specialty = req.query.specialty;

    const doctors = await Doctor.find(filter)
      .select("name specialty licenseNumber")
      .sort({ name: 1 });

    return res.json(doctors);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: error.message });
  }
};

/**
 * GET /api/doctors/:id
 * Detalle completo de un médico.
 */
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID no válido." });
    }
    const doctor = await Doctor.findById(id).populate("health", "name codigo municipio departamento");
    if (!doctor) return res.status(404).json({ msg: "Médico no encontrado." });
    return res.json(doctor);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: error.message });
  }
};

/**
 * POST /api/doctors
 * Crear nuevo médico. Requiere admin o branchManager.
 */
const createDoctor = async (req, res) => {
  try {
    if (!req.user.admin && !req.user.branchManager) {
      return res.status(403).json({ msg: "No tienes permisos para realizar esta acción." });
    }

    const { name, specialty, licenseNumber, contactInfo, yearsOfExperience, health } = req.body;

    if (!name || !specialty || !licenseNumber || !contactInfo?.phone || !health) {
      return res.status(400).json({ msg: "Todos los campos obligatorios deben estar completos." });
    }

    const hcQuery = isMongoObjectId(String(health))
      ? { _id: health }
      : { codigo: Number(health) };
    const hc = await HealthCenter.findOne(hcQuery);
    if (!hc) return res.status(404).json({ msg: "Centro de salud no encontrado." });

    if (req.user.branchManager && hc._id.toString() !== req.user.health.toString()) {
      return res.status(403).json({ msg: "Solo puedes crear médicos en tu propio centro de salud." });
    }

    const existingLicense = await Doctor.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({ msg: "El número de licencia ya está en uso." });
    }

    if (contactInfo.email) {
      const existingEmail = await Doctor.findOne({ "contactInfo.email": contactInfo.email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ msg: "El correo electrónico ya está en uso." });
      }
    }

    const doctor = new Doctor({
      name,
      specialty,
      licenseNumber,
      contactInfo,
      yearsOfExperience: yearsOfExperience ?? 0,
      health: hc._id,
    });

    await doctor.save();
    return res.status(201).json({ msg: "Médico creado correctamente.", doctor });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al crear el médico." });
  }
};

/**
 * PUT /api/doctors/:id
 * Actualizar datos de un médico. Requiere admin o branchManager.
 */
const updateDoctor = async (req, res) => {
  try {
    if (!req.user.admin && !req.user.branchManager) {
      return res.status(403).json({ msg: "No tienes permisos para realizar esta acción." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID no válido." });
    }

    const doctor = await Doctor.findById(id);
    if (!doctor) return res.status(404).json({ msg: "Médico no encontrado." });

    if (req.user.branchManager && doctor.health.toString() !== req.user.health.toString()) {
      return res.status(403).json({ msg: "No tienes permisos para editar este médico." });
    }

    const { name, specialty, licenseNumber, contactInfo, yearsOfExperience, health } = req.body;

    if (licenseNumber && licenseNumber !== doctor.licenseNumber) {
      const dup = await Doctor.findOne({ licenseNumber, _id: { $ne: id } });
      if (dup) return res.status(400).json({ msg: "El número de licencia ya está en uso." });
    }

    if (contactInfo?.email && contactInfo.email !== doctor.contactInfo?.email) {
      const dup = await Doctor.findOne({
        "contactInfo.email": contactInfo.email.toLowerCase(),
        _id: { $ne: id },
      });
      if (dup) return res.status(400).json({ msg: "El correo electrónico ya está en uso." });
    }

    if (health) {
      const hcQuery = isMongoObjectId(String(health))
        ? { _id: health }
        : { codigo: Number(health) };
      const hc = await HealthCenter.findOne(hcQuery);
      if (!hc) return res.status(404).json({ msg: "Centro de salud no encontrado." });
      doctor.health = hc._id;
    }

    doctor.name = name ?? doctor.name;
    doctor.specialty = specialty ?? doctor.specialty;
    doctor.licenseNumber = licenseNumber ?? doctor.licenseNumber;
    doctor.contactInfo = contactInfo ?? doctor.contactInfo;
    doctor.yearsOfExperience = yearsOfExperience ?? doctor.yearsOfExperience;

    const updated = await doctor.save();
    return res.json({ msg: "Médico actualizado correctamente.", doctor: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al actualizar el médico." });
  }
};

/**
 * PATCH /api/doctors/:id/toggle-status
 * Activar o desactivar un médico. Requiere admin o branchManager.
 */
const toggleDoctorStatus = async (req, res) => {
  try {
    if (!req.user.admin && !req.user.branchManager) {
      return res.status(403).json({ msg: "No tienes permisos para realizar esta acción." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID no válido." });
    }

    const doctor = await Doctor.findById(id);
    if (!doctor) return res.status(404).json({ msg: "Médico no encontrado." });

    if (req.user.branchManager && doctor.health.toString() !== req.user.health.toString()) {
      return res.status(403).json({ msg: "No tienes permisos para modificar este médico." });
    }

    doctor.active = !doctor.active;
    await doctor.save();

    return res.json({
      msg: `Médico ${doctor.active ? "activado" : "desactivado"} correctamente.`,
      active: doctor.active,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al cambiar el estado del médico." });
  }
};

export {
  getDoctors,
  getDoctorsForSelect,
  getDoctorById,
  createDoctor,
  updateDoctor,
  toggleDoctorStatus,
};
