// controllers/usersController.js
import User from "../../models/User.js";
import Health from "../../models/HealthCenter.js";
import AuditLog from "../../models/AuditLog.js";
import { crearAuditLog, ROLE_FIELD_LABELS, boolLabel } from "../../utils/auditHelper.js";
import paginate from "../../utils/pagination.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import { uniqueId } from "../../utils/index.js";

// Helper: verifica si es un ObjectId real de Mongo (24 hex chars)
// ⚠️ mongoose.Types.ObjectId.isValid() retorna true para números enteros (bug conocido de BSON)
//    por eso NO usamos isValid() para distinguir codigo vs _id
const isMongoObjectId = (value) =>
  typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);

/**
 * GET /api/users?page=&page_size=&search=&health=
 */
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 10;
    const search = req.query.search;
    const query = {};

    if (!req.user)
      return res
        .status(403)
        .json({ message: "No autorizado: Usuario no autenticado" });

    if (req.user.admin) {
      query._id = { $ne: req.user._id };
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: Number(req.query.health) };
        const hc = await Health.findOne(hcQuery);
        if (!hc)
          return res
            .status(404)
            .json({ message: "Centro de salud no encontrado." });
        query.health = hc._id;
      }
    } else if (req.user.branchManager) {
      if (!req.user.health)
        return res
          .status(400)
          .json({ message: "Branch manager sin centro asignado." });
      query.health = req.user.health;
      // BranchManager no puede ver administradores, otros gerentes, ni a sí mismo
      query.admin = { $ne: true };
      query.branchManager = { $ne: true };
      query._id = { $ne: req.user._id };
    } else {
      query._id = req.user._id;
    }

    if (search) {
      query.$or = [
        { primerApellido: { $regex: search, $options: "i" } },
        { segundoApellido: { $regex: search, $options: "i" } },
        { nombres: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { susCode: { $regex: search, $options: "i" } },
      ];
    }

    // Filtros por rol y verificación (solo admin y branchManager)
    if (req.user.admin || req.user.branchManager) {
      const { role, verified } = req.query;
      if (role === "admin") {
        query.admin = true;
      } else if (role === "branchManager") {
        query.branchManager = true;
        query.admin = { $ne: true };
      } else if (role === "doctor") {
        query.doctor = true;
        query.admin = { $ne: true };
        query.branchManager = { $ne: true };
      } else if (role === "user") {
        query.admin = { $ne: true };
        query.branchManager = { $ne: true };
        query.doctor = { $ne: true };
      }
      if (verified === "true") query.verified = true;
      else if (verified === "false") query.verified = false;
    }

    const paginatedUsers = await paginate(
      User,
      page,
      pageSize,
      query,
      [
        { path: "health", select: "name codigo nivel direccion" },
        { path: "doctorProfile", select: "name specialty" },
      ],
    );

    paginatedUsers.results = paginatedUsers.results.map((u) => {
      const obj = u.toObject ? u.toObject() : { ...u };
      delete obj.password;
      if (obj.createdAt)
        obj.createdAt = dayjs(obj.createdAt).format("DD/MM/YYYY HH:mm:ss");
      if (obj.updatedAt)
        obj.updatedAt = dayjs(obj.updatedAt).format("DD/MM/YYYY HH:mm:ss");
      return obj;
    });

    return res.status(200).json(paginatedUsers);
  } catch (error) {
    console.error("Error getUsers:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isMongoObjectId(id)) {
      return res.status(400).json({ message: "ID de usuario no válido" });
    }
    if (!req.user)
      return res
        .status(403)
        .json({ message: "No autorizado: Usuario no autenticado" });

    const targetUser = await User.findById(id);
    if (!targetUser)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const isAdmin = req.user.admin === true;
    const isBranchManager = req.user.branchManager === true;
    const isOwner = req.user._id.toString() === id;

    if (
      !isAdmin &&
      !isOwner &&
      !(
        isBranchManager &&
        targetUser.health?.toString() === req.user.health?.toString()
      )
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para editar este usuario" });
    }

    const payload = req.body;

    const ownerFields = ["primerApellido", "segundoApellido", "nombres", "email", "password", "susCode"];
    ownerFields.forEach((field) => {
      if (payload[field] !== undefined) targetUser[field] = payload[field];
    });

    if (payload.email && payload.email !== targetUser.email) {
      const exist = await User.findOne({
        email: payload.email,
        _id: { $ne: id },
      });
      if (exist)
        return res.status(400).json({ message: "El email ya está en uso" });
    }
    if (payload.susCode && payload.susCode !== targetUser.susCode) {
      const existSus = await User.findOne({
        susCode: payload.susCode,
        _id: { $ne: id },
      });
      if (existSus)
        return res.status(400).json({ message: "El susCode ya está en uso" });
    }

    if (isAdmin) {
      if (payload.admin !== undefined) targetUser.admin = !!payload.admin;
      if (payload.branchManager !== undefined)
        targetUser.branchManager = !!payload.branchManager;
      if (payload.verified !== undefined)
        targetUser.verified = !!payload.verified;

      if (payload.doctor !== undefined) targetUser.doctor = !!payload.doctor;
      if (payload.doctorProfile !== undefined) {
        const newProfile = payload.doctorProfile || null;
        if (newProfile) {
          const profileInUse = await User.findOne({
            doctorProfile: newProfile,
            _id: { $ne: targetUser._id },
          });
          if (profileInUse) {
            return res.status(400).json({ message: "Este perfil de médico ya está asignado a otro usuario." });
          }
        }
        targetUser.doctorProfile = newProfile;
      }

      if (payload.health !== undefined && payload.health !== null) {
        let hc = null;
        if (isMongoObjectId(String(payload.health))) {
          hc = await Health.findById(payload.health);
        } else {
          hc = await Health.findOne({ codigo: Number(payload.health) });
        }
        if (!hc)
          return res
            .status(404)
            .json({ message: "Centro de salud no encontrado" });
        targetUser.health = hc._id;
      }
    } else if (isBranchManager) {
      // BranchManager puede modificar doctor/doctorProfile/verified de usuarios de su centro.
      // Los campos admin, branchManager y health se ignoran (no se aplican, no causan error).
      if (payload.verified !== undefined) targetUser.verified = !!payload.verified;
      if (payload.doctor !== undefined) targetUser.doctor = !!payload.doctor;
      if (payload.doctorProfile !== undefined) {
        const newProfile = payload.doctorProfile || null;
        if (newProfile) {
          const profileInUse = await User.findOne({
            doctorProfile: newProfile,
            _id: { $ne: targetUser._id },
          });
          if (profileInUse) {
            return res.status(400).json({ message: "Este perfil de médico ya está asignado a otro usuario." });
          }
        }
        targetUser.doctorProfile = newProfile;
      }
    } else {
      // Usuario regular: no puede cambiar ningún campo de rol/centro
      if (
        payload.admin !== undefined ||
        payload.branchManager !== undefined ||
        payload.doctor !== undefined ||
        payload.doctorProfile !== undefined ||
        payload.verified !== undefined ||
        payload.health !== undefined
      ) {
        return res.status(403).json({
          message: "No autorizado para cambiar roles/verificado/centro",
        });
      }
    }

    // Capturar campos de rol que cambiaron para auditoría
    const roleFields = ["admin", "branchManager", "doctor", "doctorProfile", "verified"];
    const roleChanges = {};
    roleFields.forEach((f) => {
      if (payload[f] !== undefined) {
        const prevVal = targetUser[f] instanceof mongoose.Types.ObjectId
          ? targetUser[f]?.toString()
          : targetUser[f];
        const newVal = payload[f] instanceof mongoose.Types.ObjectId
          ? payload[f]?.toString()
          : payload[f];
        if (String(prevVal) !== String(newVal)) {
          roleChanges[f] = { from: prevVal, to: newVal };
        }
      }
    });

    await targetUser.save();

    if (Object.keys(roleChanges).length > 0) {
      // Traducir claves y valores a español para mejor legibilidad en DB
      const detallesLegibles = {};
      for (const [campo, { from, to }] of Object.entries(roleChanges)) {
        const etiqueta = ROLE_FIELD_LABELS[campo] ?? campo;
        detallesLegibles[etiqueta] = {
          anterior: boolLabel(from),
          nuevo:    boolLabel(to),
        };
      }

      crearAuditLog({
        action:      "role_change",
        performedBy: req.user,
        targetUser,
        description: `Cambio de rol/perfil para usuario ${targetUser.email}`,
        details:     detallesLegibles,
        ip:          req.ip,
      });
    }

    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("health", "name codigo nivel direccion")
      .populate("doctorProfile", "name specialty");
    const userObj = updatedUser.toObject();
    if (userObj.createdAt)
      userObj.createdAt = dayjs(userObj.createdAt).format(
        "DD/MM/YYYY HH:mm:ss",
      );
    if (userObj.updatedAt)
      userObj.updatedAt = dayjs(userObj.updatedAt).format(
        "DD/MM/YYYY HH:mm:ss",
      );

    return res
      .status(200)
      .json({ message: "Usuario actualizado con éxito", user: userObj });
  } catch (error) {
    console.error("Error updateUser:", error);
    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyValue)[0];
      return res
        .status(400)
        .json({ message: `El ${duplicatedField} ya está en uso.` });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    res.json(user);
  } catch (error) {
    console.error("getUserById error:", error);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

/**
 * POST /api/usersList
 * Crea un usuario desde el panel de administración.
 * Admin puede crear cualquier rol; branchManager solo puede crear usuarios/médicos de su propio centro.
 */
const createUser = async (req, res) => {
  try {
    if (!req.user) return res.status(403).json({ message: "No autorizado" });

    const isAdmin = req.user.admin === true;
    const isBranchManager = req.user.branchManager === true;

    if (!isAdmin && !isBranchManager) {
      return res.status(403).json({ message: "No autorizado para crear usuarios" });
    }

    const { primerApellido, segundoApellido, nombres, email, password, susCode, health, verified, admin, branchManager, doctor, doctorProfile } = req.body;

    if (!primerApellido || !nombres || !email || !password || !susCode || !health) {
      return res.status(400).json({ message: "Faltan campos obligatorios: apellido, nombres, email, contraseña, código SUS y centro de salud." });
    }

    // Verificar unicidad
    const existEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existEmail) return res.status(400).json({ message: "El email ya está en uso." });

    const existSus = await User.findOne({ susCode: susCode.trim() });
    if (existSus) return res.status(400).json({ message: "El código SUS ya está en uso." });

    // Resolver centro de salud
    let hc = null;
    if (isMongoObjectId(String(health))) {
      hc = await Health.findById(health);
    } else {
      hc = await Health.findOne({ codigo: Number(health) });
    }
    if (!hc) return res.status(404).json({ message: "Centro de salud no encontrado." });

    // BranchManager solo puede crear usuarios de su propio centro
    if (isBranchManager && !isAdmin) {
      if (hc._id.toString() !== req.user.health.toString()) {
        return res.status(403).json({ message: "Solo puede crear usuarios de su propio centro de salud." });
      }
    }

    const newUser = new User({
      primerApellido: primerApellido.trim(),
      segundoApellido: (segundoApellido || "").trim(),
      nombres: nombres.trim(),
      email: email.toLowerCase().trim(),
      password,
      susCode: susCode.trim(),
      health: hc._id,
      token: uniqueId(),
      verified: !!verified,
    });

    if (isAdmin) {
      newUser.admin = !!admin;
      newUser.branchManager = !!branchManager;
      newUser.doctor = !!doctor;
      if (doctorProfile) {
        const profileInUse = await User.findOne({ doctorProfile });
        if (profileInUse) {
          return res.status(400).json({ message: "Este perfil de médico ya está asignado a otro usuario." });
        }
      }
      newUser.doctorProfile = doctorProfile || null;
    } else if (isBranchManager) {
      // BranchManager puede crear usuarios regulares o médicos, pero no admins ni managers
      newUser.doctor = !!doctor;
      if (doctorProfile) {
        const profileInUse = await User.findOne({ doctorProfile });
        if (profileInUse) {
          return res.status(400).json({ message: "Este perfil de médico ya está asignado a otro usuario." });
        }
      }
      newUser.doctorProfile = doctorProfile || null;
    }

    await newUser.save();

    const created = await User.findById(newUser._id)
      .select("-password")
      .populate("health", "name codigo nivel direccion")
      .populate("doctorProfile", "name specialty");

    const userObj = created.toObject();
    if (userObj.createdAt) userObj.createdAt = dayjs(userObj.createdAt).format("DD/MM/YYYY HH:mm:ss");
    if (userObj.updatedAt) userObj.updatedAt = dayjs(userObj.updatedAt).format("DD/MM/YYYY HH:mm:ss");

    return res.status(201).json({ message: "Usuario creado con éxito.", user: userObj });
  } catch (error) {
    console.error("Error createUser:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `El ${field} ya está en uso.` });
    }
    return res.status(500).json({ message: error.message });
  }
};

export { getUsers, updateUser, createUser };
