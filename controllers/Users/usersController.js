// controllers/usersController.js
import User from "../../models/User.js";
import Health from "../../models/HealthCenter.js";
import paginate from "../../utils/pagination.js";
import dayjs from "dayjs";
import mongoose from "mongoose";

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
      if (req.query.health) {
        const hcQuery = isMongoObjectId(req.query.health)
          ? { _id: req.query.health }
          : { codigo: req.query.health };
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
    } else {
      query._id = req.user._id;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
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
      } else if (role === "user") {
        query.admin = { $ne: true };
        query.branchManager = { $ne: true };
      }
      if (verified === "true") query.verified = true;
      else if (verified === "false") query.verified = false;
    }

    const paginatedUsers = await paginate(
      User,
      page,
      pageSize,
      query,
      "health",
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

    const ownerFields = ["name", "email", "password", "susCode"];
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

      // ✅ FIX: usar regex estricto en lugar de ObjectId.isValid()
      //    ObjectId.isValid(200264) devuelve true para números → falla el cast
      if (payload.health !== undefined && payload.health !== null) {
        let hc = null;
        if (isMongoObjectId(String(payload.health))) {
          // Es un _id real de Mongo (24 hex chars)
          hc = await Health.findById(payload.health);
        } else {
          // Es un codigo numérico del HealthCenter
          hc = await Health.findOne({ codigo: Number(payload.health) });
        }
        if (!hc)
          return res
            .status(404)
            .json({ message: "Centro de salud no encontrado" });
        targetUser.health = hc._id;
      }
    } else {
      if (
        payload.admin !== undefined ||
        payload.branchManager !== undefined ||
        payload.verified !== undefined ||
        payload.health !== undefined
      ) {
        return res.status(403).json({
          message: "No autorizado para cambiar roles/verificado/centro",
        });
      }
    }

    await targetUser.save();

    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("health", "name codigo");
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

export { getUsers, updateUser };
