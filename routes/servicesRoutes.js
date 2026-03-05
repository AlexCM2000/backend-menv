import express from "express";
import {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByCategory,
} from "../controllers/serviceController.js";

const router = express.Router();

router.route("/").post(createService).get(getServices);

router
  .route("/:id")
  .get(getServiceById)
  .put(updateService)
  .delete(deleteService);

  router.route("/category/:category").get(getServicesByCategory); // Nueva ruta para obtener servicios por categoría


export default router;
