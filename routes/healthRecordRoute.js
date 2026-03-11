import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createHealthRecord,
  getHealthRecords,
  getHealthRecord,
  addObservation,
  addDiagnosis,
  addPreviousTreatment,
  addMedication,
  addAllergy,
  updateRecordState,
  archiveRecord,
  unarchiveHealthRecord,
} from "../controllers/healthRecordController.js";

const router = express.Router();

// Listar todos los historiales (auth para filtros por rol)
router.get("/", authMiddleware, getHealthRecords);

// Crear un historial médico vacío para un paciente (requiere auth)
router.post("/", authMiddleware, createHealthRecord);

// Obtener un historial por ID
router.get("/:id", getHealthRecord);

// Añadir subdocumentos al historial existente
router.post("/:id/observations", authMiddleware, addObservation);
router.post("/:id/diagnoses", authMiddleware, addDiagnosis);
router.post("/:id/previous-treatments", authMiddleware, addPreviousTreatment);
router.post("/:id/medications", authMiddleware, addMedication);
router.post("/:id/allergies", authMiddleware, addAllergy);

// Cambiar el estado del historial
router.patch("/:id/state", authMiddleware, updateRecordState);

// Archivar (soft-delete) un historial
router.delete("/:id", authMiddleware, archiveRecord);

// Desarchivar un historial
router.patch("/:id/unarchive", authMiddleware, unarchiveHealthRecord);
export default router;
