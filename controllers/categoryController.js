import Category from "../models/Category.js";
import Services from "../models/Services.js";
import { validateObjectId, handleNotFoundError } from "../utils/index.js";

const getCategories = async (req, res) => {
  try {
    const query = {};
    if (req.query.active !== undefined) {
      query.active = req.query.active === "true";
    }
    const categories = await Category.find(query).sort({ name: 1 });
    return res.json(categories);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al obtener categorías" });
  }
};

const getCategoryById = async (req, res) => {
  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const category = await Category.findById(id);
  if (!category) return handleNotFoundError("La categoría no existe", res);

  return res.json(category);
};

const createCategory = async (req, res) => {
  const isStaff = req.user.admin || req.user.branchManager;
  if (!isStaff) {
    return res.status(403).json({ msg: "No tienes permisos para crear categorías" });
  }

  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ msg: "El nombre es obligatorio" });
  }

  const exists = await Category.findOne({ name: name.trim() });
  if (exists) {
    return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
  }

  try {
    const category = new Category({
      name: req.body.name,
      description: req.body.description || "",
      icon: req.body.icon || "assistance.png",
      active: req.body.active !== undefined ? req.body.active : true,
    });
    await category.save();
    return res.json({ msg: "Categoría creada correctamente", category });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
    }
    return res.status(500).json({ msg: "Error al crear la categoría" });
  }
};

const updateCategory = async (req, res) => {
  const isStaff = req.user.admin || req.user.branchManager;
  if (!isStaff) {
    return res.status(403).json({ msg: "No tienes permisos para editar categorías" });
  }

  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const category = await Category.findById(id);
  if (!category) return handleNotFoundError("La categoría no existe", res);

  const { name } = req.body;
  if (name && name.trim() !== category.name) {
    const exists = await Category.findOne({ name: name.trim(), _id: { $ne: id } });
    if (exists) {
      return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
    }
  }

  try {
    if (name) category.name = name.trim();
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.icon) category.icon = req.body.icon;
    if (req.body.active !== undefined) category.active = req.body.active;

    await category.save();
    return res.json({ msg: "Categoría actualizada correctamente", category });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Ya existe una categoría con ese nombre" });
    }
    return res.status(500).json({ msg: "Error al actualizar la categoría" });
  }
};

const deleteCategory = async (req, res) => {
  if (!req.user.admin) {
    return res.status(403).json({ msg: "Solo los administradores pueden eliminar categorías" });
  }

  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const category = await Category.findById(id);
  if (!category) return handleNotFoundError("La categoría no existe", res);

  const servicesCount = await Services.countDocuments({ category: category.name });
  if (servicesCount > 0) {
    return res.status(400).json({
      msg: `No se puede eliminar la categoría porque tiene ${servicesCount} servicio(s) asociado(s). Reasigna o elimina los servicios primero.`
    });
  }

  try {
    await category.deleteOne();
    return res.json({ msg: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al eliminar la categoría" });
  }
};

export { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };