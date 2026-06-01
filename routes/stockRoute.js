import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getStock,
  getAvailableStock,
  getExpiringStock,
  createStock,
  updateStock,
  toggleStockActive,
} from "../controllers/stockController.js";

const router = express.Router();

router.get("/",             authMiddleware, getStock);
router.get("/available",    authMiddleware, getAvailableStock);
router.get("/expiring",     authMiddleware, getExpiringStock);
router.post("/",            authMiddleware, createStock);
router.put("/:id",          authMiddleware, updateStock);
router.patch("/:id/toggle", authMiddleware, toggleStockActive);

export default router;
