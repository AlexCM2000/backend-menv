import Stock from "../models/Stock.js";
import mongoose from "mongoose";
import { escapeRegex } from "../utils/index.js";

const canManageStock = (user) =>
  user.admin || user.branchManager || user.pharmacist;

const getHealthFilter = (user, queryHealth) => {
  if (user.admin) {
    return queryHealth ? { health: new mongoose.Types.ObjectId(String(queryHealth)) } : {};
  }
  return { health: new mongoose.Types.ObjectId(String(user.health)) };
};

export const getStock = async (req, res) => {
  try {
    const { search, health, active, page = 1, page_size = 20 } = req.query;
    const filter = getHealthFilter(req.user, health);

    if (active !== undefined) filter.active = active === "true";
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

    const skip = (Number(page) - 1) * Number(page_size);
    const [results, count] = await Promise.all([
      Stock.find(filter)
        .populate("health", "name")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(page_size))
        .lean(),
      Stock.countDocuments(filter),
    ]);

    res.json({ results, count });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener stock" });
  }
};

export const getAvailableStock = async (req, res) => {
  try {
    const healthId = req.query.health ?? req.user.health;
    if (!healthId) return res.status(400).json({ msg: "Centro de salud requerido" });

    const results = await Stock.find({
      health: new mongoose.Types.ObjectId(String(healthId)),
      active: true,
      availableQuantity: { $gt: 0 },
    })
      .select("name category pharmaceuticalForm unit availableQuantity minimumQuantity")
      .sort({ name: 1 })
      .lean();

    res.json(results);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al obtener medicamentos disponibles" });
  }
};

export const createStock = async (req, res) => {
  try {
    if (!canManageStock(req.user))
      return res.status(403).json({ msg: "Sin permisos para gestionar stock" });

    const { name, category, pharmaceuticalForm, unit, availableQuantity, minimumQuantity } = req.body;
    if (!name || !category || !pharmaceuticalForm || !unit || minimumQuantity === undefined)
      return res.status(400).json({ msg: "Todos los campos son requeridos" });

    const healthId = req.user.admin && req.body.health ? req.body.health : req.user.health;

    const stock = await Stock.create({
      name,
      category,
      pharmaceuticalForm,
      unit,
      availableQuantity: availableQuantity ?? 0,
      minimumQuantity,
      health: healthId,
    });

    res.status(201).json(stock);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al crear medicamento" });
  }
};

export const updateStock = async (req, res) => {
  try {
    if (!canManageStock(req.user))
      return res.status(403).json({ msg: "Sin permisos para gestionar stock" });

    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ msg: "Medicamento no encontrado" });

    if (!req.user.admin && String(stock.health) !== String(req.user.health))
      return res.status(403).json({ msg: "No pertenece a su centro de salud" });

    const allowed = ["name", "category", "pharmaceuticalForm", "unit", "availableQuantity", "minimumQuantity", "active"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) stock[field] = req.body[field];
    });

    await stock.save();
    res.json(stock);
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al actualizar medicamento" });
  }
};

export const toggleStockActive = async (req, res) => {
  try {
    if (!canManageStock(req.user))
      return res.status(403).json({ msg: "Sin permisos para gestionar stock" });

    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ msg: "Medicamento no encontrado" });

    if (!req.user.admin && String(stock.health) !== String(req.user.health))
      return res.status(403).json({ msg: "No pertenece a su centro de salud" });

    stock.active = !stock.active;
    await stock.save();
    res.json({ msg: `Medicamento ${stock.active ? "activado" : "desactivado"}`, active: stock.active });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al cambiar estado del medicamento" });
  }
};
