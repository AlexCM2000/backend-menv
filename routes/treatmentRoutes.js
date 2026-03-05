import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { createTreatment, getTreatments } from "../controllers/treatmentController.js";

const router = express.Router();

router.route("/").get(authMiddleware,getTreatments).post(authMiddleware,createTreatment);

export default router;
