import Diagnoses from "../models/Diagnoses.js";
import Doctor from "../models/Doctor.js";
import Treatment from "../models/PreviousTreatments.js";


const getTreatments = async (req, res) => {
  try {
    const treatments = await Treatment.find();
  return  res.status(200).json(treatments);
  } catch (error) {
   return res.status(404).json({ message: error.message });
  }
};

const createTreatment = async (req, res) => {
  const {
    dateOfTreatment,
    treatment,
    doctor,
  } = req.body;

  // Verificar que todos los campos requeridos estén presentes
  if (!dateOfTreatment || !treatment || !doctor) {
      return res.status(400).json({ message: "Todos los campos obligatorios deben estar completos" });
  }

 // Verificar si el doctor existe utilizando el campo `doctor`
 const existingDoctor = await Doctor.findOne({ licenseNumber: doctor });
 if (!existingDoctor) {
     return res.status(404).json({ msg: 'Doctor inexistente' });
 }


  try {
      // Crear un nuevo tratamiento con los datos proporcionados
      const newTreatment = new Treatment({
          dateOfTreatment,
          treatment,
          doctor:existingDoctor._id, 
      });

      // Guardar el doctor en la base de datos
      await newTreatment.save();

      // Responder con un mensaje de éxito y los datos del doctor creado
      res.json({
          msg: "El tratamiento se creó correctamente",
          diagnoses: newTreatment,
      });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Hubo un error al crear el tratamiento" });
  }
};
export{
    getTreatments,
    createTreatment
}