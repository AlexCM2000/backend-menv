import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getDoctors, createDoctor } from "../controllers/DoctorController.js";

const router = express.Router();

router.route("/").get(authMiddleware,getDoctors).post(authMiddleware,createDoctor);

export default router;
