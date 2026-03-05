import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js"
import {createPatient,deletePatient,getPatients, updatePatient} from "../../controllers/Medical-History/patientController.js"

const router = express.Router();

router.route("/").get(authMiddleware,getPatients).post(authMiddleware,createPatient);

router.route("/:id").put(authMiddleware,updatePatient).delete(authMiddleware,deletePatient)

export default router;
