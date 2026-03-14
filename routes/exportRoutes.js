import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  exportAppointments,
  exportPatients,
  exportHealthRecords,
  exportUsers,
} from "../controllers/exports/exportController.js";

const router = Router();

// Todos los endpoints requieren sesión iniciada (JWT)
router.get("/appointments",   authMiddleware, exportAppointments);
router.get("/patients",       authMiddleware, exportPatients);
router.get("/health-records", authMiddleware, exportHealthRecords);
router.get("/users",          authMiddleware, exportUsers);

export default router;
