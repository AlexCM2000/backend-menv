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
  addAllergy,
  addVitalSigns,
  addVaccine,
  exportHealthRecordPDF,
  updateRecordState,
  archiveRecord,
  unarchiveHealthRecord,
} from "../controllers/healthRecordController.js";

const router = express.Router();

router.get("/", authMiddleware, getHealthRecords);
router.post("/", authMiddleware, createHealthRecord);
router.get("/by-appointment/:appointmentId", authMiddleware, getHealthRecordByAppointment);
router.get("/:id/report", authMiddleware, exportHealthRecordPDF);
router.get("/:id",        authMiddleware, getHealthRecord);

router.post("/:id/observations",        authMiddleware, addObservation);
router.post("/:id/diagnoses",           authMiddleware, addDiagnosis);
router.post("/:id/previous-treatments", authMiddleware, addPreviousTreatment);
router.post("/:id/allergies",           authMiddleware, addAllergy);
router.post("/:id/vital-signs",         authMiddleware, addVitalSigns);
router.post("/:id/vaccines",            authMiddleware, addVaccine);

router.patch("/:id/state",     authMiddleware, updateRecordState);
router.delete("/:id",          authMiddleware, archiveRecord);
router.patch("/:id/unarchive", authMiddleware, unarchiveHealthRecord);

export default router;