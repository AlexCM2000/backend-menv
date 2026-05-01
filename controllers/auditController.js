import AuditLog from "../models/AuditLog.js";

/** Formatea una fecha en zona horaria de Bolivia (UTC-4) */
const formatBolivia = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const ACTION_LABELS = {
  role_change:               "Cambio de rol",
  password_reset:            "Restablecimiento de contraseña",
  patient_delete:            "Eliminación de paciente",
  health_record_state_change:"Cambio de estado (historial)",
  profile_update:            "Actualización de perfil",
};

/**
 * GET /api/audit-logs
 * Solo accesible por admin.
 * Query: page, page_size, action
 */
export const getAuditLogs = async (req, res) => {
  try {
    if (!req.user?.admin) {
      return res.status(403).json({ message: "Solo administradores pueden ver los logs de auditoría." });
    }

    const page     = parseInt(req.query.page)      || 1;
    const pageSize = parseInt(req.query.page_size) || 20;
    const action   = req.query.action;

    const filter = {};
    if (action) filter.action = action;

    const total = await AuditLog.countDocuments(filter);

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("performedBy", "primerApellido segundoApellido nombres email admin branchManager doctor")
      .populate("targetUser",  "primerApellido segundoApellido nombres email")
      .lean();

    const results = logs.map((log) => {
      const fullName = (u) =>
        u ? [u.primerApellido, u.segundoApellido, u.nombres].filter(Boolean).join(" ") : null;

      const performedByRole = (u) => {
        if (!u) return null;
        if (u.admin)         return "Admin";
        if (u.branchManager) return "Gerente";
        if (u.doctor)        return "Médico";
        return "Usuario";
      };

      return {
        _id:         log._id,
        action:      log.action,
        actionLabel: ACTION_LABELS[log.action] ?? log.action,
        description: log.description,
        details:     log.details,
        ip:          log.ip,
        createdAt:   formatBolivia(log.createdAt),
        performedBy: log.performedBy
          ? {
              _id:   log.performedBy._id,
              name:  fullName(log.performedBy),
              email: log.performedBy.email,
              role:  performedByRole(log.performedBy),
            }
          : null,
        targetUser: log.targetUser
          ? {
              _id:   log.targetUser._id,
              name:  fullName(log.targetUser),
              email: log.targetUser.email,
            }
          : null,
        targetId: log.targetId,
      };
    });

    return res.json({ count: total, page, page_size: pageSize, results });
  } catch (error) {
    console.error("Error getAuditLogs:", error);
    return res.status(500).json({ message: error.message });
  }
};
