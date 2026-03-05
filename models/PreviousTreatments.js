import mongoose from "mongoose";

const healthSchema = mongoose.Schema({
    
    dateOfTreatment: {
        type: Date,
        required: true, // Asumiendo que la fecha es obligatoria
        default: Date.now
    },
    treatment: {
        type: String, 
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
}, { timestamps: true });

const Treatment = mongoose.model("PreviousTreatment", healthSchema);
export default Treatment;
