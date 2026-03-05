import express from "express";
import { createHealth, getHealths } from "../controllers/healthController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(getHealths).post(authMiddleware,createHealth);

export default router;
