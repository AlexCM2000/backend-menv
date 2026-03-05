import express from "express";
import { createSus, getSus } from "../controllers/susController.js";

const router = express.Router();

router.route("/").get(getSus).post(createSus);

export default router;
