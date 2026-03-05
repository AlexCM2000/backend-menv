import Doctor from "../models/Doctor.js";
import HealthCenter from "../models/HealthCenter.js";

const getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find();
  return  res.status(200).json(doctors);
  } catch (error) {
   return res.status(404).json({ message: error.message });
  }
};

const createDoctor = async (req, res) => {
  const {
      name,
      specialty,
      licenseNumber,
      contactInfo,
      yearsOfExperience,
      health,
  } = req.body;

  // Verificar que todos los campos requeridos estén presentes
  if (!name || !specialty || !licenseNumber || !contactInfo || !contactInfo.phone || !health) {
      return res.status(400).json({ message: "Todos los campos obligatorios deben estar completos" });
  }

 // Verificar si el centro de salud existe utilizando el campo `codigo`
 const healthID = await HealthCenter.findOne({ codigo:health });
 if (!healthID) {
     return res.status(404).json({ msg: 'Centro de salud no encontrado con el código proporcionado.' });
 }

 const existingDoctor = await Doctor.findOne({ licenseNumber });
 if (existingDoctor) {
     return res.status(400).json({ message: "El número de licencia ya está en uso." });
 }

 const existingEmail = await Doctor.findOne({ 'contactInfo.email': contactInfo.email });
 if (existingEmail) {
     return res.status(400).json({ message: "El correo electóonico ya está en uso." });
 }

  try {
      // Crear un nuevo doctor con los datos proporcionados
      const doctor = new Doctor({
          name,
          specialty,
          licenseNumber,
          contactInfo, // Se espera que contactInfo contenga email, phone y address
          yearsOfExperience,
          health:healthID._id, // ID del centro de salud
      });

      // Guardar el doctor en la base de datos
      await doctor.save();

      // Responder con un mensaje de éxito y los datos del doctor creado
      res.json({
          msg: "El doctor se creó correctamente",
          doctor,
      });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Hubo un error al crear el doctor" });
  }
};
export{
    getDoctors ,
    createDoctor
}