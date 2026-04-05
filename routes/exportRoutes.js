import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  exportAppointments,
  exportPatients,
  exportHealthRecords,
  exportUsers,
  exportDoctors,
  exportServices,
  exportCategories,
} from "../controllers/exports/exportController.js";

const router = Router();

// Todos los endpoints requieren sesión iniciada (JWT)
router.get("/appointments",   authMiddleware, exportAppointments);
router.get("/patients",       authMiddleware, exportPatients);
router.get("/health-records", authMiddleware, exportHealthRecords);
router.get("/users",          authMiddleware, exportUsers);
router.get("/doctors",        authMiddleware, exportDoctors);
router.get("/services",       authMiddleware, exportServices);
router.get("/categories",     authMiddleware, exportCategories);

export default router;
