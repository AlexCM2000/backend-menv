import express from "express";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(authMiddleware, getCategories).post(authMiddleware, createCategory);
router
  .route("/:id")
  .get(authMiddleware, getCategoryById)
  .put(authMiddleware, updateCategory)
  .delete(authMiddleware, deleteCategory);

export default router;