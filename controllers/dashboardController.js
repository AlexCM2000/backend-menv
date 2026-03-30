import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import mongoose from "mongoose";

const getDashboardStats = async (req, res) => {
  try {
    const range = req.query.range || "month";
    const now = new Date();

    // Límites de hoy
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Rango seleccionado
    let rangeStart, rangeEnd;
    if (range === "today") {
      rangeStart = todayStart;
      rangeEnd = todayEnd;
    } else if (range === "week") {
      rangeStart = new Date(todayStart);
      rangeStart.setDate(todayStart.getDate() - 6);
      rangeEnd = todayEnd;
    } else {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Filtro por centro de salud
    const apptFilter = {};
    const patientFilter = { eliminado_en: null };
    const doctorFilter = {};

    if (!req.user.admin && req.user.branchManager && req.user.health) {
      const hid = new mongoose.Types.ObjectId(String(req.user.health));
      apptFilter.health = hid;
      patientFilter.healthCenter = hid;
      doctorFilter.health = hid;
    } else if (req.user.admin && req.query.health) {
      const hid = new mongoose.Types.ObjectId(req.query.health);
      apptFilter.health = hid;
      patientFilter.healthCenter = hid;
      doctorFilter.health = hid;
    }

    // KPIs principales en paralelo
    const [citasHoy, citasRango, pacientes, medicosActivos] = await Promise.all([
      Appointment.countDocuments({ ...apptFilter, date: { $gte: todayStart, $lte: todayEnd } }),
      Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd } }),
      Patient.countDocuments(patientFilter),
      Doctor.countDocuments({ ...doctorFilter, active: true }),
    ]);

    // Tasa de asistencia
    const [completadas, noAsistio] = await Promise.all([
      Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd }, state: "Completada" }),
      Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd }, state: "No asistio" }),
    ]);
    const citasRealizadas = completadas + noAsistio;
    const tasaAsistencia = citasRealizadas > 0
      ? Math.round((completadas / citasRealizadas) * 100)
      : null;

    // Distribución por estado
    const citasPorEstado = await Appointment.aggregate([
      { $match: { ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]);

    // Tendencia diaria (últimos N días)
    const trendDays = range === "today" ? 1 : range === "week" ? 7 : 30;
    const trendStart = new Date(todayStart);
    trendStart.setDate(todayStart.getDate() - (trendDays - 1));

    const tendenciaPorDia = await Appointment.aggregate([
      { $match: { ...apptFilter, date: { $gte: trendStart, $lte: todayEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Citas por especialidad médica
    const citasPorEspecialidad = await Appointment.aggregate([
      {
        $match: {
          ...apptFilter,
          date: { $gte: rangeStart, $lte: rangeEnd },
          doctor: { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "doctor",
          foreignField: "_id",
          as: "doc",
        },
      },
      { $unwind: { path: "$doc", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$doc.specialty", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Top 5 médicos por número de citas
    const topMedicos = await Appointment.aggregate([
      {
        $match: {
          ...apptFilter,
          date: { $gte: rangeStart, $lte: rangeEnd },
          doctor: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$doctor", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },
      {
        $project: {
          _id: 0,
          name: "$doctor.name",
          specialty: "$doctor.specialty",
          count: 1,
        },
      },
    ]);

    res.json({
      kpis: {
        citasHoy,
        citasRango,
        pacientes,
        medicosActivos,
        tasaAsistencia,
        completadas,
        noAsistio,
      },
      citasPorEstado,
      tendenciaPorDia,
      citasPorEspecialidad,
      topMedicos,
      range,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener estadísticas del dashboard" });
  }
};

export { getDashboardStats };