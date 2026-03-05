import Services from "../models/Services.js";
import { handleNotFoundError, validateObjectId } from "../utils/index.js";

const createService = async (req, res) => {
  console.log(req.body);
  if (Object.values(req.body).includes("")) {
    const error = new Error("todos los campos son obligatorios");
    return res.status(400).json({
      msg: error.message,
    });
  }

  try {
    const service = new Services(req.body);
    const result = await service.save();
    //res.json(result);
    res.json({
      msg: "el servicio se creó correctamente",
    });
  } catch (error) {
    console.log(error);
  }
};

const getServices = async (req, res) => {
  try {
    const services = await Services.find();
    res.json(services);
  } catch (error) {
    console.log(error);
    // res.json(services);
  }
};

// En serviceController.js
 const getServicesByCategory = async (req, res) => {
  const { category } = req.params; // Obtiene la categoría de los parámetros

  try {
    const services = await Services.find({ category }); // Filtra los servicios por categoría
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener servicios por categoría' });
  }
};

const getServiceById = async (req, res) => {
  const { id } = req.params;
  if (validateObjectId(id, res)) return;
  // VALIDAR QUE EXISTA
  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }
  //MOSTRAR EL SERVICIO
  res.json(service);
};

const updateService = async (req, res) => {
  const { id } = req.params;

  //VALIDAR UN OBJECT ID
  if (validateObjectId(id, res)) return;

  // VALIDAR QUE EXISTA
  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }

  service.name = req.body.name || service.name;
  service.price = req.body.price || service.price;

  try {
    await service.save();
    res.json(service);
  } catch (error) {
    console.log(error);
  }
};

const deleteService = async (req, res) => {
  const { id } = req.params;

  //VALIDAR UN OBJECT ID
  if (validateObjectId(id, res)) return;

  // VALIDAR QUE EXISTA
  const service = await Services.findById(id);
  if (!service) {
    return handleNotFoundError("El registro no existe", res);
  }
  try {
    await service.deleteOne();
    res.json({
      msg: "el servicio se elimino correctamente",
    });
  } catch (error) {
    console.log(error);
  }
};

export {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByCategory
};
