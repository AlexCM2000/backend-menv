import mongoose from "mongoose";

const observationSchema = mongoose.Schema({
    
    dateOfObservation: {
        type: Date,
        required: true, // Asumiendo que la fecha es obligatoria
        default: Date.now // Establecer la fecha actual por defecto si no se proporciona
    },
    observation: {
        type: String, // Cambiado a String para almacenar una descripción del diagnóstico
        required: true // Asumiendo que el diagnóstico es obligatorio
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
}, { timestamps: true });

const Observation = mongoose.model("Observation", observationSchema);
export default Observation;
