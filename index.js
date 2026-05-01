import express from "express";
import dotenv from "dotenv";
import colors from "colors";
import cors from "cors";
import { db } from "./config/db.js";
import servicesRoutes from "./routes/servicesRoutes.js";
import logger from "morgan";
import authRoutes from "./routes/authRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import susRoutes from "./routes/susRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import healthRecordRoutes from "./routes/healthRecordRoute.js";
import patientRoutes from "./routes/medical-history/patientRoutes.js";
import userListRoutes from "./routes/users/usersRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";

//variables de entorno
dotenv.config();

const app = express();

//leer datos via body
app.use(express.json());
app.use(logger("dev"));
//conectar db
db();

//CONFIGURAR CORS

const whiteList = [process.env.FRONTEND_URL, undefined];

const corsOptions = {
  origin: function (origin, callback) {
    if (whiteList.includes(origin)) {
      //permitir conexion
      callback(null, true);
    } else {
      //denegar conexion
      callback(new Error("Error de CORS"));
    }
  },
};
app.use(cors(corsOptions));

app.use("/api/services", servicesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/sus", susRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/health-records", healthRecordRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/usersList", userListRoutes);
app.use("/api/export",   exportRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit-logs", auditRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(colors.blue("El servidor se ejecuta en:", PORT));
});
