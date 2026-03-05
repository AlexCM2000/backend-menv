import Diagnoses from "../models/Diagnoses.js";
import Doctor from "../models/Doctor.js";


const getDiagnoses = async (req, res) => {
  try {
    const diagnoses = await Diagnoses.find();
  return  res.status(200).json(diagnoses);
  } catch (error) {
   return res.status(404).json({ message: error.message });
  }
};

const createDiagnoses = async (req, res) => {
  const {
    dateOfDiagnosis,
    diagnosis,
    doctor,
  } = req.body;

  // Verificar que todos los campos requeridos estén presentes
  if (!dateOfDiagnosis || !diagnosis || !doctor) {
      return res.status(400).json({ message: "Todos los campos obligatorios deben estar completos" });
  }

 // Verificar si el doctor existe utilizando el campo `doctor`
 const existingDoctor = await Doctor.findOne({ licenseNumber: doctor });
 if (!existingDoctor) {
     return res.status(404).json({ msg: 'Doctor inexistente' });
 }


  try {
      // Crear un nuevo doctor con los datos proporcionados
      const diagnoses = new Diagnoses({
          dateOfDiagnosis,
          diagnosis,
          doctor:existingDoctor._id, 
      });

      // Guardar el doctor en la base de datos
      await diagnoses.save();

      // Responder con un mensaje de éxito y los datos del doctor creado
      res.json({
          msg: "El diagnóstico se creó correctamente",
          diagnoses: diagnoses,
      });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Hubo un error al crear el diagnóstico" });
  }
};
export{
    getDiagnoses,
    createDiagnoses
}