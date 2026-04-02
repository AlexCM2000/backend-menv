import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createHealthRecord,
  getHealthRecords,
  getHealthRecord,
  getHealthRecordByAppointment,
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

// Listado paginado
router.get("/", authMiddleware, getHealthRecords);

// Crear nuevo historial
router.post("/", authMiddleware, createHealthRecord);

// Obtener historial por cita (debe ir antes de /:id)
router.get("/by-appointment/:appointmentId", authMiddleware, getHealthRecordByAppointment);

// Detalle de historial por ID (protegido con auth)
router.get("/:id", authMiddleware, getHealthRecord);

// Agregar subdocumentos clínicos
router.post("/:id/observations", authMiddleware, addObservation);
router.post("/:id/diagnoses", authMiddleware, addDiagnosis);
router.post("/:id/previous-treatments", authMiddleware, addPreviousTreatment);
router.post("/:id/medications", authMiddleware, addMedication);
router.post("/:id/allergies", authMiddleware, addAllergy);

// Cambiar estado (activo / en tratamiento / cerrado)
router.patch("/:id/state", authMiddleware, updateRecordState);

// Archivar (soft delete)
router.delete("/:id", authMiddleware, archiveRecord);

// Desarchivar
router.patch("/:id/unarchive", authMiddleware, unarchiveHealthRecord);

export default router;