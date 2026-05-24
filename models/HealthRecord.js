import mongoose from "mongoose";

const healthRecordSchema = new mongoose.Schema(
  {
    /**
     * Referencia al paciente propietario de este historial.
     * Un paciente solo puede tener un HealthRecord.
     */
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      unique: true,
    },

    /**
     * Estado general del historial.
     * - activo: abierto para nuevas anotaciones.
     * - en tratamiento: paciente en proceso activo.
     * - cerrado: historial finalizado.
     */
    state: {
      type: String,
      enum: ["activo", "cerrado", "en tratamiento"],
      default: "activo",
    },

    /**
     * Diagnósticos realizados al paciente.
     * Cada diagnóstico incluye código, descripción, fecha y autor.
     */
    diagnoses: [
      {
        code: String,
        description: String,
        notes: String,
        date: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
      },
    ],

    /**
     * Tratamientos previos seguidos por el paciente.
     * Se registra rango de fechas y autor.
     */
    previousTreatments: [
      {
        treatment: String,
        from: Date,
        to: Date,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    /**
     * Historial de alergias o reacciones adversas.
     * Cada registro documenta sustancia, reacción, fecha y autor.
     */
    allergyHistory: [
      {
        substance: String,
        reaction: String,
        date: Date,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    /**
     * Observaciones clínicas generales.
     * Anotaciones libres con fecha y autor.
     */
    observations: [
      {
        note: String,
        date: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
      },
    ],

    /**
     * Signos vitales registrados en consulta.
     */
    vitalSigns: [
      {
        date:              { type: Date, default: Date.now },
        systolicBP:        { type: Number, default: null },   // mmHg
        diastolicBP:       { type: Number, default: null },   // mmHg
        heartRate:         { type: Number, default: null },   // lpm
        temperature:       { type: Number, default: null },   // °C
        oxygenSaturation:  { type: Number, default: null },   // %
        weight:            { type: Number, default: null },   // kg
        notes:             { type: String, default: "" },
        createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    /**
     * Registro de vacunas aplicadas.
     */
    vaccines: [
      {
        name:       { type: String, required: true },
        doseNumber: { type: String, default: "" },
        lot:        { type: String, default: "" },
        date:       { type: Date, default: Date.now },
        appliedBy:  { type: String, default: "" },
        notes:      { type: String, default: "" },
        createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    /**
     * Citas médicas asociadas.
     */
    medicalAppointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
      },
    ],

    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * HealthRecord model
 */
const HealthRecord = mongoose.model("HealthRecord", healthRecordSchema);
export default HealthRecord;
