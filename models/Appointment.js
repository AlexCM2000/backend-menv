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
    state: {
        type: String,
        enum: [
            "Pendiente", 
            "Reprogramada", 
            "Cancelada", 
            "Completada", 
            "No asistio"
        ],
        default: "Pendiente"  // Estado inicial
    }
    
})
 const Appointment = mongoose.model("Appointment", appointmentSchema)
  export default Appointment;