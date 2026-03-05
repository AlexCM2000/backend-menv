import Health from "../models/HealthCenter.js";

const getHealths = async (req, res) => {
  try {
    const healths = await Health.find();
  return  res.status(200).json(healths);
  } catch (error) {
   return res.status(404).json({ message: error.message });
  }
};

const createHealth = async (req, res) => {
    console.log(req.body);
    const { name, direccion, nivel, municipio, departamento, codigo } = req.body;

    // Verificar que todos los campos requeridos estén presentes
    if (!name || !direccion || !nivel || !municipio || !departamento || !codigo) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }
  
    try {
      const health = new Health(req.body);
       await health.save();
      res.json({
        msg: "el centro de salud se creó correctamente",
      });
    } catch (error) {
      console.log(error);
    }
  };

export{
    getHealths,
    createHealth
}