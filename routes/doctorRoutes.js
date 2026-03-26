import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getDoctors,
  getDoctorsForSelect,
  getDoctorById,
  createDoctor,
  updateDoctor,
  toggleDoctorStatus,
} from "../controllers/DoctorController.js";

const router = express.Router();

// Lista simple para dropdowns (debe ir ANTES de /:id para evitar conflicto)
router.get("/select", authMiddleware, getDoctorsForSelect);

// CRUD principal
router.route("/")
  .get(authMiddleware, getDoctors)
  .post(authMiddleware, createDoctor);

router.route("/:id")
  .get(authMiddleware, getDoctorById)
  .put(authMiddleware, updateDoctor);

router.patch("/:id/toggle-status", authMiddleware, toggleDoctorStatus);

export default router;
