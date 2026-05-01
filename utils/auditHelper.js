/**
 * auditHelper.js
 * Utilidad para crear registros de auditoría con datos legibles en MongoDB.
 */
import AuditLog from "../models/AuditLog.js";

/** Mapa de códigos de acción a etiquetas en español */
const ACTION_LABELS = {
  role_change:                "Cambio de rol",
  password_reset:             "Restablecimiento de contraseña",
  patient_delete:             "Eliminación de paciente",
  health_record_state_change: "Cambio de estado (historial clínico)",
  profile_update:             "Actualización de perfil",
};

/** Formatea una fecha en zona horaria de Bolivia (UTC-4) como texto legible */
const fechaBolivia = (date = new Date()) =>
  new Date(date).toLocaleString("es-BO", {
    timeZone:  "America/La_Paz",
    day:       "2-digit",
    month:     "long",
    year:      "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    false,
  });

/**
 * Crea un registro de auditoría con campos desnormalizados y legibles.
 *
 * @param {object} opts
 * @param {string}   opts.action          - Código de acción (enum del modelo)
 * @param {object}   opts.performedBy     - Documento User completo del ejecutor
 * @param {object}   [opts.targetUser]    - Documento User del afectado (opcional)
 * @param {string}   [opts.targetId]      - ObjectId de otra entidad afectada
 * @param {string}   [opts.description]   - Descripción legible de la acción
 * @param {object}   [opts.details]       - Detalles adicionales ya legibles
 * @param {string}   [opts.ip]            - IP del cliente
 */
export const crearAuditLog = ({
  action,
  performedBy,
  targetUser = null,
  targetId   = null,
  description,
  details    = null,
  ip         = null,
}) => {
  const nombre = (u) =>
    u ? [u.primerApellido, u.segundoApellido, u.nombres].filter(Boolean).join(" ") : null;

  AuditLog.create({
    action,
    accion:          ACTION_LABELS[action] ?? action,
    performedBy:     performedBy?._id ?? performedBy,
    performedByName: nombre(performedBy),
    targetUser:      targetUser?._id ?? targetUser,
    targetUserName:  nombre(targetUser),
    targetId,
    description,
    details,
    ip,
    fechaBolivia:    fechaBolivia(),
  }).catch(() => {});
};

/** Traduce un campo de rol interno a su etiqueta en español */
export const ROLE_FIELD_LABELS = {
  admin:         "Administrador",
  branchManager: "Gestor de sucursal",
  doctor:        "Médico",
  doctorProfile: "Perfil de médico",
  verified:      "Cuenta verificada",
};

/** Convierte un valor booleano a texto legible */
export const boolLabel = (v) => {
  if (v === true  || v === "true")  return "Sí";
  if (v === false || v === "false") return "No";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};
