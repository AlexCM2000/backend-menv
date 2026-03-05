import mongoose from "mongoose";
const patientSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["Masculino", "Femenino"],
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    contactInfo: {
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      address: {
        type: String,
        required: false,
        trim: true,
      },
    },
    emergencyContact: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      relationship: {
        type: String,
        required: true,
        trim: true,
      },
    },
    medicalConditions: [
      {
        type: String,
        trim: true,
      },
    ],
    allergies: [
      {
        type: String,
        trim: true,
      },
    ],
    medicalHistory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRecord", // Asegúrate de que este sea el nombre correcto de tu modelo de citas.
    },
    appointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment", // Asegúrate de que este sea el nombre correcto de tu modelo de citas.
      },
    ],
    healthCenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Health", // referencia al centro médico
      required: true,
    },
    susCode: {
      type: String,
      ref: "Sus", // referencia al código SUS
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Referencia al modelo de usuario
    },
    eliminado_en: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

patientSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { eliminado_en: null } }
);

patientSchema.index(
  { susCode: 1 },
  { unique: true, partialFilterExpression: { eliminado_en: null } }
);

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
