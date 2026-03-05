import Sus from "../models/Sus.js";
const getSus = async (req, res) => {
  try {
    const sus = await Sus.find();
  return  res.status(200).json(sus);
  } catch (error) {
   return res.status(404).json({ message: error.message });
  }
};

const createSus = async (req, res) => {
    const { name, codigo } = req.body;

    // Verificar que todos los campos requeridos estén presentes
    if (!name || !codigo) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }
    try {
      const sus = new Sus(req.body);
       await sus.save();
      res.json({
        msg: "el id unico SUS se creó correctamente",
      });
    } catch (error) {
      console.log(error);
    }
  };

export{
    getSus ,
    createSus 
}