import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import HealthRecord from "../models/HealthRecord.js";
import { parse, formatISO, startOfDay, endOfDay, isValid } from "date-fns";
import { formatDate, handleNotFoundError, validateObjectId } from "../utils/index.js";
import { sendEmailDeleteAppointment, sendEmailNewAppointment, sendEmailUpdateAppointment } from "../emails/appointmentEmailService.js";
import mongoose from "mongoose";


const createAppointment = async (req, res) => {
    const isStaff = req.user.admin || req.user.branchManager;

    // Admin/branchManager pueden crear citas para otro usuario (targetUserId en body)
    let appointmentUserId = req.user._id.toString();
    let appointmentHealth = req.user.health;

    if (isStaff && req.body.targetUserId) {
        const targetUser = await User.findById(req.body.targetUserId).select("health");
        if (!targetUser) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        appointmentUserId = targetUser._id.toString();
        appointmentHealth = targetUser.health;
    } else if (!req.user.health) {
        return res.status(400).json({ message: "El usuario no tiene un centro de salud asignado." });
    }

    const { date, totalAmount, time } = req.body;
    if (!date || !Number.isFinite(totalAmount) || !time) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    const healthId = new mongoose.Types.ObjectId(appointmentHealth);

    // Normalizar la fecha al inicio del día para consistencia
    const normalizedDate = startOfDay(new Date(date));

    // Determinar el médico a asignar
    let doctorToAssign = req.body.doctor || null;

    if (doctorToAssign) {
        // Médico específico: verificar que no esté duplicado
        const existing = await Appointment.findOne({
            doctor: doctorToAssign,
            time,
            date: { $gte: startOfDay(normalizedDate), $lte: endOfDay(normalizedDate) }
        });
        if (existing) {
            return res.status(409).json({ msg: "Este médico ya tiene una cita en este horario. Selecciona otro médico u otro horario." });
        }
    } else {
        // Sin médico: auto-asignar de la categoría del servicio
        if (req.body.services && req.body.services.length > 0) {
            const ServicesModel = (await import("../models/Services.js")).default;
            const service = await ServicesModel.findById(req.body.services[0]);
            if (service?.category) {
                const availableDoctors = await Doctor.find({
                    health: healthId,
                    specialty: service.category,
                    active: true
                });

                if (availableDoctors.length === 0) {
                    return res.status(409).json({ msg: `No hay médicos disponibles para la especialidad "${service.category}" en este centro de salud.` });
                }

                // Médicos ya ocupados en este horario
                const bookedAppointments = await Appointment.find({
                    health: healthId,
                    time,
                    date: { $gte: startOfDay(normalizedDate), $lte: endOfDay(normalizedDate) },
                    doctor: { $ne: null }
                }).select("doctor");
                const bookedDoctorIds = bookedAppointments.map(a => a.doctor.toString());
                const freeDoctors = availableDoctors.filter(d => !bookedDoctorIds.includes(d._id.toString()));

                if (freeDoctors.length === 0) {
                    return res.status(409).json({ msg: "No hay médicos disponibles en este horario para esta especialidad." });
                }
                doctorToAssign = freeDoctors[0]._id;
            }
        }
    }

    const newAppointmentData = {
        services: req.body.services,
        date: normalizedDate,
        time,
        totalAmount,
        notes: req.body.notes || "",
        state: req.body.state || "Pendiente",
        doctor: doctorToAssign,
        user: appointmentUserId,
        health: healthId,
    };

    // Guardar con manejo de race condition (índice único)
    const newAppointment = new Appointment(newAppointmentData);
    try {
        const result = await newAppointment.save();
        sendEmailNewAppointment({ date: formatDate(result.date), time: result.time })
            .catch(err => console.error("Error al enviar email de nueva cita:", err));
        return res.json({ msg: "Cita creada correctamente" });
    } catch (saveError) {
        if (saveError.code === 11000) {
            return res.status(409).json({ msg: "Este horario fue tomado en el último momento. Por favor selecciona otro horario." });
        }
        console.log(saveError);
        return res.status(500).json({ msg: "Error al crear la cita" });
    }
}

const getAppointmentDate = async (req, res) => {
    const { date } = req.query;
    const newDate = parse(date, "dd/MM/yyyy", new Date());
    try {
        if (!isValid(newDate)) {
            return res.status(400).json({ message: "Fecha inválida" });
        }
        const isoDate = formatISO(newDate);
        const query = {
            date: {
                $gte: startOfDay(new Date(isoDate)),
                $lte: endOfDay(new Date(isoDate))
            }
        };
        // Filtrar por health center del usuario
        if (req.user.health) query.health = req.user.health;
        const appointments = await Appointment.find(query).select("time doctor");
        return res.json(appointments);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error al obtener citas" });
    }
};

const getAvailability = async (req, res) => {
    try {
        const { date, category, excludeId } = req.query;
        if (!date || !category) return res.status(400).json({ msg: "date y category son requeridos" });

        const newDate = parse(date, "dd/MM/yyyy", new Date());
        if (!isValid(newDate)) return res.status(400).json({ msg: "Fecha inválida" });

        const healthId = req.user.health;

        // Médicos activos de esa especialidad en el centro
        const doctors = await Doctor.find({
            health: healthId,
            specialty: category,
            active: true
        }).select("_id name specialty");

        // Citas en ese centro ese día
        const isoDate = formatISO(newDate);
        const appointmentQuery = {
            health: healthId,
            date: { $gte: startOfDay(new Date(isoDate)), $lte: endOfDay(new Date(isoDate)) }
        };
        // Excluir la cita actual si se está editando
        if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
            appointmentQuery._id = { $ne: excludeId };
        }

        const appointments = await Appointment.find(appointmentQuery).select("time doctor");

        return res.json({ doctors, appointments });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Error al obtener disponibilidad" });
    }
};

const getAppointmentById = async (req, res) => {
    const { id } = req.params;
    if (validateObjectId(id, res)) return;

    //validar que exista
    const appointment = await Appointment.findById(id).populate("services");
    if (!appointment) {
        return handleNotFoundError("La cita no existe", res);
    }
    if (appointment.user._id.toString() !== req.user._id.toString()) {
        const error = new Error("No tienes los permisos para ver esta cita");
        return res.status(403).json({ msg: error.message });
    }
    //retornar
    res.json(appointment);
}

const updateAppointment = async (req, res) => {
    const { id } = req.params;
    if (validateObjectId(id, res)) return;

    // Validar que exista la cita
    const appointment = await Appointment.findById(id).populate("services");
    if (!appointment) {
        return handleNotFoundError("La cita no existe", res);
    }

    // Validar permisos: admin, branchManager y doctor pueden actualizar cualquier cita
    const isStaff = req.user.admin || req.user.branchManager || req.user.doctor;
    if (!isStaff && appointment.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ msg: "No tienes los permisos para modificar esta cita" });
    }

    const { services, time, date, totalAmount, state, doctor, notes } = req.body;

    // Definir los estados válidos
    const validStates = [
        'Pendiente',
        'Reprogramada',
        'Cancelada',
        'Completada',
        'No asistio'
    ];

    // Validar que 'state' esté presente y sea válido
    if (!state) {
        return res.status(400).json({ msg: "El campo 'state' es obligatorio" });
    } else if (!validStates.includes(state)) {
        return res.status(400).json({ msg: `El estado '${state}' no es válido. Los estados permitidos son: ${validStates.join(', ')}` });
    }

    // Actualizar solo los campos que estén presentes en req.body
    if (date) appointment.date = date;
    if (services) appointment.services = services;
    if (time) appointment.time = time;
    if (totalAmount) appointment.totalAmount = totalAmount;
    if (doctor !== undefined) appointment.doctor = doctor || null;
    if (notes !== undefined) appointment.notes = notes;
    appointment.state = state;

    try {
        const result = await appointment.save();

        // Auto-vincular al HistorialClínico cuando la cita se completa
        if (state === "Completada") {
            try {
                const apptUser = await User.findById(appointment.user._id).select("susCode");
                if (apptUser?.susCode) {
                    const patient = await Patient.findOne({ susCode: apptUser.susCode, eliminado_en: null }).select("medicalHistory");
                    if (patient?.medicalHistory) {
                        await HealthRecord.findByIdAndUpdate(
                            patient.medicalHistory,
                            { $addToSet: { medicalAppointments: appointment._id } }
                        );
                    }
                }
            } catch (linkErr) {
                console.error("Error al vincular cita al historial (no bloqueante):", linkErr);
            }
        }

        sendEmailUpdateAppointment({ date: formatDate(result.date), time: result.time })
            .catch(err => console.error("Error al enviar email de actualización:", err));

        res.json({ msg: "Cita actualizada correctamente" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Error al actualizar la cita" });
    }
};


const deleteAppointment = async (req, res) => {
    const { id } = req.params;
    if (validateObjectId(id, res)) return;
    //validar que exista
    const appointment = await Appointment.findById(id).populate("services");
    if (!appointment) {
        return handleNotFoundError("La cita no existe", res);
    }
    if (appointment.user._id.toString() !== req.user._id.toString()) {
        const error = new Error("No tienes los permisos para ver esta cita");
        return res.status(403).json({ msg: error.message });
    }
    try {
        const result = await appointment.deleteOne();

        sendEmailDeleteAppointment({ date: formatDate(result.date), time: result.time })
            .catch(err => console.error("Error al enviar email de eliminación:", err));

        res.json({ msg: "Cita eliminada correctamente" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Error al eliminar la cita" });
    }
}

const getCalendarAppointments = async (req, res) => {
    const { start, end } = req.query;
    const user = req.user;

    if (!start || !end) {
        return res.status(400).json({ msg: "Se requieren los parámetros start y end" });
    }

    try {
        const query = {
            date: { $gte: new Date(start), $lte: new Date(end) }
        };

        if (user.admin) {
            // Admin total: ve todas las citas sin filtro
        } else if (user.branchManager) {
            // Gestor de sucursal: solo ve las citas de su centro
            if (user.health) query.health = user.health;
        } else {
            // Usuario regular: solo sus propias citas
            query.user = user._id;
        }

        const appointments = await Appointment.find(query)
            .populate('services', 'name category')
            .populate('user', 'name')
            .populate('health', 'name');

        res.json(appointments);
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Error al obtener las citas del calendario" });
    }
}

//exportar
export {
    createAppointment, getAppointmentDate, getAvailability, getAppointmentById, updateAppointment, deleteAppointment, getCalendarAppointments
}