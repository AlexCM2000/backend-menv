import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
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
    } else if (range === "custom") {
      rangeStart = req.query.date_from
        ? new Date(req.query.date_from)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = req.query.date_to
        ? new Date(req.query.date_to)
        : new Date(todayEnd);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Filtro por centro de salud / rol
    const apptFilter = {};
    const patientFilter = { eliminado_en: null };
    const doctorFilter = {};
    const isDoctor = req.user.doctor && req.user.doctorProfile;

    // Excluir pacientes vinculados a usuarios staff por user ID, email o susCode
    const staffUsers = await User.find({
      $or: [{ admin: true }, { doctor: true }, { branchManager: true }],
    }).select("_id email susCode").lean();
    const _ec = [];
    const _sIds    = staffUsers.map(u => u._id);
    const _sEmails = staffUsers.map(u => u.email).filter(Boolean);
    const _sSus    = staffUsers.map(u => u.susCode).filter(Boolean);
    if (_sIds.length)    _ec.push({ user:    { $in: _sIds } });
    if (_sEmails.length) _ec.push({ email:   { $in: _sEmails } });
    if (_sSus.length)    _ec.push({ susCode: { $in: _sSus } });
    if (_ec.length) {
      const _sp = await Patient.find({ $or: _ec, eliminado_en: null }).select("_id").lean();
      if (_sp.length) patientFilter._id = { $nin: _sp.map(p => p._id) };
    }

    if (isDoctor) {
      // Médico: solo ve sus propias citas
      apptFilter.doctor = req.user.doctorProfile;
      if (req.user.health) {
        const hid = new mongoose.Types.ObjectId(String(req.user.health));
        apptFilter.health = hid;
      }
    } else if (!req.user.admin && req.user.branchManager && req.user.health) {
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
    // Médico no necesita contar pacientes ni médicos activos
    const [citasHoy, citasRango, pacientes, medicosActivos] = await Promise.all([
      Appointment.countDocuments({ ...apptFilter, date: { $gte: todayStart, $lte: todayEnd } }),
      Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd } }),
      isDoctor ? Promise.resolve(null) : Patient.countDocuments(patientFilter),
      isDoctor ? Promise.resolve(null) : Doctor.countDocuments({ ...doctorFilter, active: true }),
    ]);

    // Tasa de asistencia (médico no la ve)
    let completadas = null;
    let noAsistio = null;
    let tasaAsistencia = null;
    if (!isDoctor) {
      [completadas, noAsistio] = await Promise.all([
        Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd }, state: "Completada" }),
        Appointment.countDocuments({ ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd }, state: "No asistio" }),
      ]);
    }
    if (!isDoctor) {
      const citasRealizadas = completadas + noAsistio;
      tasaAsistencia = citasRealizadas > 0
        ? Math.round((completadas / citasRealizadas) * 100)
        : null;
    }

    // Distribución por estado
    const citasPorEstado = await Appointment.aggregate([
      { $match: { ...apptFilter, date: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]);

    // Tendencia diaria
    let trendStart, trendEnd;
    if (range === "custom") {
      trendStart = rangeStart;
      trendEnd = rangeEnd;
    } else {
      const trendDays = range === "today" ? 1 : range === "week" ? 7 : 30;
      trendStart = new Date(todayStart);
      trendStart.setDate(todayStart.getDate() - (trendDays - 1));
      trendEnd = todayEnd;
    }

    const tendenciaPorDia = await Appointment.aggregate([
      { $match: { ...apptFilter, date: { $gte: trendStart, $lte: trendEnd } } },
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

    // Top 5 médicos por número de citas (médico no lo ve)
    const topMedicos = isDoctor ? [] : await Appointment.aggregate([
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
      isDoctor,
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