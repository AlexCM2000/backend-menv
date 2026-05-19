import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getPrescriptions,
  getPrescriptionById,
  getPrescriptionsByPatient,
  createPrescription,
  dispenseItems,
  deletePrescription,
} from "../controllers/prescriptionController.js";

const router = express.Router();

router.get("/",                       authMiddleware, getPrescriptions);
router.get("/patient/:patientId",     authMiddleware, getPrescriptionsByPatient);
router.get("/:id",                    authMiddleware, getPrescriptionById);
router.post("/",                      authMiddleware, createPrescription);
router.put("/:id/dispense",           authMiddleware, dispenseItems);
router.delete("/:id",                 authMiddleware, deletePrescription);

export default router;
