import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import checkAuth from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", checkAuth, getDashboardStats);

export default router;