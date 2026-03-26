import mongoose from "mongoose";

const appointmentSchema = mongoose.Schema({
    services:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Services"
    }],
    date:{
        type: Date,
        required: true,
        trim: true
    },
    time:{
        type: String,
        required: true,
        trim: true
    },
    totalAmount:{
        type: Number,
        required: true,
        trim: true
    },
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    health:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Health",
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        default: null
    },
    state: {
        type: String,
        enum: [
            "Pendiente",
            "Reprogramada",
            "Cancelada",
            "Completada",
            "No asistio"
        ],
        default: "Pendiente"
    }
}, { timestamps: true });

appointmentSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true, sparse: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);
export default Appointment;