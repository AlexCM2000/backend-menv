import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getConfig, updateConfig, resetConfig } from "../controllers/cdssConfigController.js";

const router = express.Router();

router.get("/",       authMiddleware, getConfig);
router.put("/",       authMiddleware, updateConfig);
router.post("/reset", authMiddleware, resetConfig);

export default router;
