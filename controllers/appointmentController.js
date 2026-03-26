import { json } from "express";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
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

    const newAppointmentData = {
        services: req.body.services,
        date,
        time,
        totalAmount,
        state: req.body.state || "Pendiente",
        doctor: req.body.doctor || null,
        user: appointmentUserId,
        health: healthId,
    };

    try {
        const newAppointment = new Appointment(newAppointmentData);
        const result = await newAppointment.save();

        await sendEmailNewAppointment({
            date: formatDate(result.date),
            time: result.time,
        });

        return res.json({ msg: "Cita creada correctamente" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error al crear la cita" });
    }
}

const getAppointmentDate =async(req,res)=>{
    const {date} = req.query
    const newDate = parse(date,"dd/MM/yyyy", new Date())
    try {
        if(!isValid(newDate)){
            const error = new Error("Fecha invalida")
            return res.status(400).json({message:error.message})
        }
        const isoDate = formatISO(newDate)
        const appointments = await Appointment.find({date:
            {
                $gte:startOfDay(new Date(isoDate)),
                $lte:endOfDay(new Date(isoDate))
            }
        }).select("time")
      return  res.json(
            appointments
        ) 
    } catch (error) {
        console.log(error)
    }
    

}

const getAppointmentById =async(req, res)=>{
const {id}=req.params
    if(validateObjectId(id,res)) return

    //validar que exista
    const appointment = await Appointment.findById(id).populate("services")
    if(!appointment){
      
        return handleNotFoundError("La cita no existe", res)
    }
    if(appointment.user._id.toString() !== req.user._id.toString()){
        const error = new Error("No tienes los permisos para ver esta cita")
        return res.status(403).json({msg:error.message})
    }
    //retornar
    res.json(appointment)
}

const updateAppointment = async (req, res) => {
    const { id } = req.params;
    if (validateObjectId(id, res)) return;

    // Validar que exista la cita
    const appointment = await Appointment.findById(id).populate("services");
    if (!appointment) {
        return handleNotFoundError("La cita no existe", res);
    }

    // Validar permisos de usuario
    if (appointment.user._id.toString() !== req.user._id.toString()) {
        const error = new Error("No tienes los permisos para ver esta cita");
        return res.status(403).json({ msg: error.message });
    }

    const { services, time, date, totalAmount, state, doctor } = req.body;

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
    appointment.state = state; // 'state' siempre se actualiza, ya que es obligatorio

    try {
        const result = await appointment.save();

        // Enviar correo de actualización
        await sendEmailUpdateAppointment({
            date: formatDate(result.date),
            time: result.time,
        });

        // Retornar mensaje de éxito
        res.json({ msg: "Cita actualizada correctamente" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Error al actualizar la cita" });
    }
};


const deleteAppointment =async(req, res)=>{
    const {id}=req.params
    if(validateObjectId(id,res)) return
    //validar que exista
    const appointment = await Appointment.findById(id).populate("services")
    if(!appointment){
      
        return handleNotFoundError("La cita no existe", res)
    }
    if(appointment.user._id.toString() !== req.user._id.toString()){
        const error = new Error("No tienes los permisos para ver esta cita")
        return res.status(403).json({msg:error.message})
    }
    try {
        const result = await appointment.deleteOne()

        await sendEmailDeleteAppointment({
            date:formatDate(result.date),
            time:result.time,
        })

        //mostrar mensaje

        res.json({msg:"Cita eliminada correctamente"})

    } catch (error) {
        console.log(error)
    }
}

const getCalendarAppointments = async (req, res) => {
    const { start, end } = req.query
    const user = req.user

    if (!start || !end) {
        return res.status(400).json({ msg: "Se requieren los parámetros start y end" })
    }

    try {
        const query = {
            date: { $gte: new Date(start), $lte: new Date(end) }
        }

        if (user.admin) {
            // Admin total: ve todas las citas sin filtro
        } else if (user.branchManager) {
            // Gestor de sucursal: solo ve las citas de su centro
            if (user.health) query.health = user.health
        } else {
            // Usuario regular: solo sus propias citas
            query.user = user._id
        }

        const appointments = await Appointment.find(query)
            .populate('services', 'name category')
            .populate('user', 'name')
            .populate('health', 'name')

        res.json(appointments)
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: "Error al obtener las citas del calendario" })
    }
}

//exportar

export {
    createAppointment, getAppointmentDate, getAppointmentById, updateAppointment, deleteAppointment, getCalendarAppointments
}