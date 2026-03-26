import mongoose from "mongoose";

/**
 * HealthRecord Schema
 *
 * Representa el historial médico de un paciente.
 * - Un único registro por paciente (patient es unique).
 * - Se documentan diagnósticos, tratamientos, medicaciones, alergias y observaciones.
 * - Mantiene trazabilidad con quién y cuándo creó cada entrada.
 * - No se eliminan registros: se archivan con archivedAt.
 */
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
     * Medicaciones prescritas.
     * Incluye nombre, dosis, periodo y autor.
     */
    medications: [
      {
        name: String,
        dose: String,
        start: Date,
        end: Date,
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
     * Citas médicas asociadas.
     * Relaciona con el modelo Appointment.
     */
    medicalAppointments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
      },
    ],

    /**
     * Fecha en que el historial fue archivado.
     * null = aún activo.
     */
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * HealthRecord model
 */
const HealthRecord = mongoose.model("HealthRecord", healthRecordSchema);
export default HealthRecord;
