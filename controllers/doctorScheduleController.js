import DoctorSchedule from '../models/DoctorSchedule.js';
import Doctor from '../models/Doctor.js';
import { validateObjectId } from '../utils/index.js';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const getSchedules = async (req, res) => {
  const { id } = req.params;
  if (validateObjectId(id, res)) return;
  try {
    const schedules = await DoctorSchedule.find({ doctor: id });
    res.json(schedules);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: 'Error al obtener horarios del médico' });
  }
};

export const saveSchedules = async (req, res) => {
  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const canManage = req.user.admin || req.user.branchManager;
  if (!canManage) return res.status(403).json({ msg: 'Sin permisos para gestionar horarios' });

  const doctor = await Doctor.findById(id);
  if (!doctor) return res.status(404).json({ msg: 'Médico no encontrado' });

  if (!req.user.admin && String(doctor.health) !== String(req.user.health)) {
    return res.status(403).json({ msg: 'Sin acceso a este médico' });
  }

  const { schedules } = req.body;
  if (!Array.isArray(schedules)) return res.status(400).json({ msg: 'schedules debe ser un array' });

  try {
    const ops = schedules
      .filter(s => DAYS.includes(s.dayOfWeek))
      .map(s => ({
        updateOne: {
          filter: { doctor: id, dayOfWeek: s.dayOfWeek },
          update: {
            $set: {
              morning: !!s.morning,
              afternoon: !!s.afternoon,
              active: s.active !== false,
            },
          },
          upsert: true,
        },
      }));

    if (ops.length > 0) await DoctorSchedule.bulkWrite(ops);
    const updated = await DoctorSchedule.find({ doctor: id });
    res.json(updated);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: 'Error al guardar horarios' });
  }
};
