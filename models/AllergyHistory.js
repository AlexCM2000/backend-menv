import mongoose from "mongoose";

const allergySchema = mongoose.Schema({
    
    dateOfAllergyHistory: {
        type: Date,
        required: true, // Asumiendo que la fecha es obligatoria
        default: Date.now // Establecer la fecha actual por defecto si no se proporciona
    },
    allergy: {
        type: String, // Cambiado a String para almacenar una descripción del diagnóstico
        required: true // Asumiendo que el diagnóstico es obligatorio
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
}, { timestamps: true });

const Allergy = mongoose.model("Allergy", allergySchema);
export default Allergy;
