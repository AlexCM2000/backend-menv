import Prescription from "../models/Prescription.js";
import Stock from "../models/Stock.js";
import mongoose from "mongoose";
import { escapeRegex } from "../utils/index.js";

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `RX-${datePart}-${suffix}`;
};

export const getPrescriptions = async (req, res) => {
  try {
    const { search, status, patient, page = 1, page_size = 20 } = req.query;
    const filter = {};

    // Farmacéutico y branchManager ven solo su centro
    if (!req.user.admin) {
      filter.health = new mongoose.Types.ObjectId(String(req.user.health));
    } else if (req.query.health) {
      filter.health = new mongoose.Types.ObjectId(String(req.query.health));
    }

    // El doctor solo ve las recetas que él creó
    if (req.user.doctor && !req.user.admin) {
      filter.prescribedBy = req.user._id;
    }

    if (status) filter.status = status;
    if (patient) filter.patient = new mongoose.Types.ObjectId(String(patient));

    if (search) {
      filter.$or = [
        { code: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(page_size);
    const [results, count] = await Promise.all([
      Prescription.find(filter)
        .populate("patient", "primerApellido segundoApellido nombres susCode")
        .populate("prescribedBy", "primerApellido segundoApellido nombres")
        .populate("doctor", "name specialty")
        .populate("health", "name")
        .populate("items.stock", "name unit")
        .populate("items.dispensedBy", "primerApellido nombres")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(page_size))
        .lean(),
      Prescription.countDocuments(filter),
    ]);

    res.json({ results, count });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener recetas" });
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate("patient", "primerApellido segundoApellido nombres susCode dateOfBirth gender")
      .populate("prescribedBy", "primerApellido segundoApellido nombres susCode")
      .populate("doctor", "name specialty licenseNumber")
      .populate("health", "name direccion municipio")
      .populate("items.stock", "name unit pharmaceuticalForm")
      .populate("items.dispensedBy", "primerApellido nombres")
      .lean();

    if (!prescription) return res.status(404).json({ msg: "Receta no encontrada" });

    if (!req.user.admin && String(prescription.health._id) !== String(req.user.health))
      return res.status(403).json({ msg: "Sin acceso a esta receta" });

    res.json(prescription);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener receta" });
  }
};

export const getPrescriptionsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const prescriptions = await Prescription.find({ patient: patientId })
      .populate("prescribedBy", "primerApellido segundoApellido nombres")
      .populate("doctor", "name specialty")
      .populate("items.stock", "name unit pharmaceuticalForm")
      .sort({ createdAt: -1 })
      .lean();

    res.json(prescriptions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener recetas del paciente" });
  }
};

export const createPrescription = async (req, res) => {
  try {
    const canCreate = req.user.admin || req.user.branchManager || req.user.doctor;
    if (!canCreate)
      return res.status(403).json({ msg: "Sin permisos para crear recetas" });

    const { patient, appointment, items, notes } = req.body;
    if (!patient || !items || items.length === 0)
      return res.status(400).json({ msg: "Paciente e ítems son requeridos" });

    // Validar que todos los medicamentos pertenecen al centro del usuario
    const healthId = req.user.health;
    const stockIds = items.map((i) => i.stock);
    const stocks = await Stock.find({
      _id: { $in: stockIds },
      health: healthId,
      active: true,
    }).lean();

    if (stocks.length !== stockIds.length)
      return res.status(400).json({ msg: "Uno o más medicamentos no están disponibles en este centro" });

    const stockMap = Object.fromEntries(stocks.map((s) => [String(s._id), s]));

    // Construir ítems
    const prescriptionItems = items.map((item) => ({
      stock: item.stock,
      medicationName: stockMap[String(item.stock)].name,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      quantityToDispense: item.quantityToDispense,
      quantityDispensed: 0,
      dispensed: false,
    }));

    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (attempts < 5 && (await Prescription.exists({ code })));

    const doctorProfile = req.user.doctorProfile ?? null;

    const prescription = await Prescription.create({
      code,
      patient,
      prescribedBy: req.user._id,
      doctor: doctorProfile,
      appointment: appointment ?? null,
      health: healthId,
      items: prescriptionItems,
      notes: notes ?? "",
    });

    await prescription.populate([
      { path: "patient", select: "primerApellido segundoApellido nombres susCode" },
      { path: "prescribedBy", select: "primerApellido segundoApellido nombres" },
      { path: "doctor", select: "name specialty licenseNumber" },
      { path: "health", select: "name" },
      { path: "items.stock", select: "name unit pharmaceuticalForm" },
    ]);

    res.status(201).json(prescription);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al crear receta" });
  }
};

export const deletePrescription = async (req, res) => {
  try {
    const canDelete = req.user.admin || req.user.branchManager || req.user.doctor;
    if (!canDelete)
      return res.status(403).json({ msg: "Sin permisos para eliminar recetas" });

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ msg: "Receta no encontrada" });

    if (prescription.status !== "Pendiente")
      return res.status(400).json({ msg: "Solo se pueden eliminar recetas en estado Pendiente" });

    if (!req.user.admin && String(prescription.health) !== String(req.user.health))
      return res.status(403).json({ msg: "Sin acceso a esta receta" });

    await prescription.deleteOne();
    res.json({ msg: "Receta eliminada correctamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al eliminar receta" });
  }
};

export const dispenseItems = async (req, res) => {
  try {
    const canDispense = req.user.admin || req.user.branchManager || req.user.pharmacist;
    if (!canDispense)
      return res.status(403).json({ msg: "Sin permisos para despachar recetas" });

    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ msg: "Receta no encontrada" });

    if (prescription.status === "Despachada")
      return res.status(400).json({ msg: "Esta receta ya fue completamente despachada" });

    if (!req.user.admin && String(prescription.health) !== String(req.user.health))
      return res.status(403).json({ msg: "No pertenece a su centro de salud" });

    // req.body.items = [{ itemId, quantityDispensed }]
    const { items } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ msg: "Debe indicar los ítems a despachar" });

    for (const dispatch of items) {
      const item = prescription.items.id(dispatch.itemId);
      if (!item) continue;
      if (item.dispensed) continue;

      const qtyToDispatch = Number(dispatch.quantityDispensed);
      if (qtyToDispatch <= 0) continue;

      // Verificar stock disponible
      const stock = await Stock.findById(item.stock);
      if (!stock || !stock.active)
        return res.status(400).json({ msg: `Medicamento ${item.medicationName} no disponible` });

      const remainingToDispatch = item.quantityToDispense - item.quantityDispensed;
      const actualDispatch = Math.min(qtyToDispatch, remainingToDispatch);

      if (stock.availableQuantity < actualDispatch)
        return res.status(400).json({
          msg: `Stock insuficiente para ${item.medicationName}. Disponible: ${stock.availableQuantity} ${stock.unit}`,
        });

      // Descontar del stock
      stock.availableQuantity -= actualDispatch;
      await stock.save();

      // Actualizar ítem
      item.quantityDispensed += actualDispatch;
      item.dispensedBy = req.user._id;
      item.dispensedAt = new Date();
      if (item.quantityDispensed >= item.quantityToDispense) {
        item.dispensed = true;
      }
    }

    // Actualizar estado de la receta
    const allDispensed = prescription.items.every((i) => i.dispensed);
    prescription.status = allDispensed ? "Despachada" : "Pendiente";

    await prescription.save();

    await prescription.populate([
      { path: "patient", select: "primerApellido segundoApellido nombres susCode" },
      { path: "prescribedBy", select: "primerApellido segundoApellido nombres" },
      { path: "doctor", select: "name specialty" },
      { path: "items.stock", select: "name unit" },
      { path: "items.dispensedBy", select: "primerApellido nombres" },
    ]);

    res.json(prescription);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al despachar receta" });
  }
};
