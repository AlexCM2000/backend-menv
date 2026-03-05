import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { createDiagnoses, getDiagnoses } from "../controllers/diagnosesController.js";

const router = express.Router();

router.route("/").get(authMiddleware,getDiagnoses).post(authMiddleware,createDiagnoses);

export default router;
