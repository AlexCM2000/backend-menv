import mongoose from "mongoose";

/**
 * AuditLog
 *
 * Registra operaciones sensibles realizadas en el sistema:
 * - Cambios de rol (admin, doctor, branchManager, doctorProfile, verified)
 * - Restablecimiento de contraseña
 * - Eliminación (soft-delete) de pacientes
 * - Cambios de estado en historiales clínicos
 */
const auditLogSchema = new mongoose.Schema(
  {
    /** Tipo de acción realizada (código interno) */
    action: {
      type: String,
      required: true,
      enum: [
        "role_change",
        "password_reset",
        "patient_delete",
        "health_record_state_change",
        "profile_update",
      ],
    },

    /** Etiqueta legible de la acción en español */
    accion: {
      type: String,
      default: null,
    },

    /** Usuario que realizó la acción */
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /** Usuario/entidad afectada (opcional según la acción) */
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /** Entidad afectada (ID genérico para pacientes, historiales, etc.) */
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    /** Descripción legible de la acción */
    description: {
      type: String,
      trim: true,
    },

    /** Detalles adicionales: campos cambiados, valores anteriores/nuevos */
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /** IP del cliente (si se envía en el request) */
    ip: {
      type: String,
      trim: true,
      default: null,
    },

    /** Nombre legible del usuario que realizó la acción (desnormalizado) */
    performedByName: {
      type: String,
      default: null,
    },

    /** Nombre legible del usuario afectado (desnormalizado) */
    targetUserName: {
      type: String,
      default: null,
    },

    /** Fecha/hora en zona horaria Bolivia (UTC-4) como texto legible */
    fechaBolivia: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
