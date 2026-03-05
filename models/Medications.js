import mongoose from "mongoose";

const medicationSchema = mongoose.Schema({
    
    dateOfMedications: {
        type: Date,
        required: true, // Asumiendo que la fecha es obligatoria
        default: Date.now // Establecer la fecha actual por defecto si no se proporciona
    },
    medications: {
        type: String, // Cambiado a String para almacenar una descripción del diagnóstico
        required: true // Asumiendo que el diagnóstico es obligatorio
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
}, { timestamps: true });

const Medications = mongoose.model("Medications", medicationSchema);
export default Medications;
