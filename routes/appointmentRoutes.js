import express from "express"
import { createAppointment, deleteAppointment, getAppointmentById, getAppointmentDate, updateAppointment } from "../controllers/appointmentController.js"
import authMiddleware from "../middleware/authMiddleware.js"

 const router = express.Router()

 router.route("/").post(authMiddleware,createAppointment).get(authMiddleware,getAppointmentDate)

 router.route("/:id").get(authMiddleware, getAppointmentById)
 .patch(authMiddleware, updateAppointment).delete(authMiddleware, deleteAppointment)
 export default router