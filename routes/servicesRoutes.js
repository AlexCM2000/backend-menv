import express from "express";
import {
  getServices,
  getServicesPaginated,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByCategory,
} from "../controllers/serviceController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(getServices).post(authMiddleware, createService);
router.route("/paginated").get(getServicesPaginated);
router.route("/category/:category").get(getServicesByCategory);
router
  .route("/:id")
  .get(getServiceById)
  .put(authMiddleware, updateService)
  .delete(authMiddleware, deleteService);

export default router;
