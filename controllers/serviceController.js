import Services from "../models/Services.js";
import Appointment from "../models/Appointment.js";
import { handleNotFoundError, validateObjectId } from "../utils/index.js";
import paginate from "../utils/pagination.js";

const createService = async (req, res) => {
  const isStaff = req.user.admin || req.user.branchManager;
  if (!isStaff) {
    return res.status(403).json({ msg: "No tienes permisos para crear servicios" });
  }

  const { name, price, category } = req.body;
  if (!name || name.trim() === "" || price === undefined || price === "" || !category || category.trim() === "") {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }

  try {
    const service = new Services({ name: name.trim(), price, category: category.trim() });
    const saved = await service.save();
    return res.json({ msg: "El servicio se creó correctamente", service: saved });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Error al crear el servicio" });
  }
};

const getServices = async (_req, res) => {
  try {
    const services = await Services.find();
    res.json(services);
  } catch (error) {
    console.log(error);
  }
};

const getServicesPaginated = async (req, res) => {
  try {
    const { page = 1, page_size = 10, search, category } = req.query;
    const query = {};

    if (search && search.trim() !== "") {
      query.name = { $regex: search.trim(), $options: "i" };
    }
    if (category && category.trim() !== "") {
      query.category = category.trim();
    }

    const result = await paginate(Services, Number(page), Number(page_size), query);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Error al obtener servicios" });
  }
};

const getServicesByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const services = await Services.find({
      category: { $regex: new RegExp(`^${category.trim()}$`, "i") }
    });
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener servicios por categoría" });
  }
};

const getServiceById = async (req, res) => {
  const { id } = req.params;
  if (validateObjectId(id, res)) return;
  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }
  res.json(service);
};

const updateService = async (req, res) => {
  const isStaff = req.user.admin || req.user.branchManager;
  if (!isStaff) {
    return res.status(403).json({ msg: "No tienes permisos para editar servicios" });
  }

  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }

  service.name = req.body.name || service.name;
  service.price = req.body.price !== undefined ? req.body.price : service.price;
  service.category = req.body.category || service.category;

  try {
    await service.save();
    res.json({ msg: "El servicio se actualizó correctamente", service });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al actualizar el servicio" });
  }
};

const deleteService = async (req, res) => {
  const isStaff = req.user.admin || req.user.branchManager;
  if (!isStaff) {
    return res.status(403).json({ msg: "No tienes permisos para eliminar servicios" });
  }

  const { id } = req.params;
  if (validateObjectId(id, res)) return;

  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }

  const pendingCount = await Appointment.countDocuments({
    services: id,
    state: "Pendiente",
  });
  if (pendingCount > 0) {
    return res.status(400).json({
      msg: `No se puede eliminar el servicio porque tiene ${pendingCount} cita(s) pendiente(s) asociada(s).`,
    });
  }

  try {
    await service.deleteOne();
    res.json({ msg: "El servicio se eliminó correctamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Error al eliminar el servicio" });
  }
};

export {
  getServices,
  getServicesPaginated,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByCategory,
};