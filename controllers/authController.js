// controllers/authController.js

import User from "../models/User.js";
import HealthCenter from "../models/HealthCenter.js";
import Patient from "../models/Patient.js";
import HealthRecord from "../models/HealthRecord.js";
import {
  sendEmailPasswordReset,
  sendEmailVerification,
} from "../emails/authEmailService.js";
import { generateJWT, uniqueId } from "../utils/index.js";
import Sus from "../models/Sus.js";

const register = async (req, res) => {
  const { email: correo, password, name: nombre, codigo, susCode } = req.body;

  console.log(req.body);

  // 1) Todos los campos obligatorios
  if (![correo, password, nombre, codigo, susCode].every(Boolean)) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }

  // 2) El email no debe existir
  if (await User.findOne({ email: correo })) {
    return res.status(400).json({ msg: "El email ingresado ya existe" });
  }

  // 3) Contraseña mínima de 8 caracteres
  if (password.trim().length < 8) {
    return res
      .status(400)
      .json({ msg: "La contraseña debe tener al menos 8 caracteres" });
  }

  // 4) Centro de salud válido
  const health = await HealthCenter.findOne({ codigo });
  if (!health) {
    return res.status(404).json({
      msg: "Centro de salud no encontrado con el código proporcionado.",
    });
  }

  // 5) Código SUS válido
  const susRecord = await Sus.findOne({ codigo: susCode });
  if (!susRecord) {
    return res.status(404).json({ msg: "El código SUS no es válido." });
  }

  // 6) Unicidad de susCode en User
  if (await User.findOne({ susCode })) {
    return res.status(400).json({
      msg: "Ya existe un usuario registrado con el mismo código SUS.",
    });
  }

  // 7) Crear y guardar usuario
  try {
    const newUser = new User({
      name: nombre,
      email: correo,
      password,
      health: health._id,
      susCode,
    });
    const saved = await newUser.save();
    sendEmailVerification({
      name: saved.name,
      email: saved.email,
      token: saved.token,
    });

    // Auto-crear ficha de paciente + historial clínico (no bloqueante)
    try {
      const nameParts = nombre.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];

      const patient = new Patient({
        firstName,
        lastName,
        email: correo,
        susCode,
        healthCenter: health._id,
        user: saved._id,
      });
      const savedPatient = await patient.save();

      const healthRecord = new HealthRecord({ patient: savedPatient._id });
      const savedRecord = await healthRecord.save();

      savedPatient.medicalHistory = savedRecord._id;
      await savedPatient.save();
    } catch (autoErr) {
      console.error("Error al crear historial automático (no bloqueante):", autoErr);
    }

    return res.json({
      msg: "El usuario se creó correctamente, revisa tu email",
    });
  } catch (err) {
    console.error("Error al crear el usuario:", err);
    return res.status(500).json({ msg: "Error al crear el usuario" });
  }
};

const verifyAccount = async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({ token });
  if (!user) {
    return res.status(401).json({ msg: "Token no válido" });
  }
  try {
    user.verified = true;
    user.token = "";
    await user.save();
    return res.json({ msg: "Cuenta verificada correctamente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al verificar la cuenta" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ msg: "El usuario no existe" });
  }
  if (!user.verified) {
    return res.status(401).json({ msg: "Tu cuenta no ha sido verificada" });
  }
  if (!(await user.checkPassword(password))) {
    return res.status(401).json({ msg: "Contraseña incorrecta" });
  }
  const token = generateJWT(user._id);
  return res.json({ token });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "El usuario no existe" });
  }
  try {
    user.token = uniqueId();
    await user.save();
    await sendEmailPasswordReset({
      name: user.name,
      email: user.email,
      token: user.token,
    });
    return res.json({ msg: "Hemos enviado un email con las instrucciones" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al procesar solicitud" });
  }
};

const verifyPasswordResetToken = async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({ token });
  if (!user) {
    return res.status(401).json({ msg: "Token no válido" });
  }
  return res.json({ msg: "Token válido y el usuario existe" });
};

const updatePassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const user = await User.findOne({ token });
  if (!user) {
    return res.status(401).json({ msg: "Token no válido" });
  }
  try {
    user.password = password;
    user.token = "";
    await user.save();
    return res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al actualizar la contraseña" });
  }
};

const user = async (req, res) => {
  // asume que `req.user` viene del middleware de autenticación
  return res.json(req.user);
};

const admin = async (req, res) => {
  const user = req.user;
  if (!user.admin) {
    return res.status(403).json({ msg: "Acción no permitida" });
  }
  return res.json(user);
};

const userAccount = async (req, res) => {
  try {
    const userId = req.params._id;
    const user = await User.findById(userId)
      .populate("susCode") // ahora populamos por susCode
      .populate("health");
    if (!user) {
      return res.status(404).json({ msg: "El usuario no existe" });
    }
    if (!user.verified) {
      return res.status(401).json({ msg: "Tu cuenta no ha sido verificada" });
    }
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al obtener datos de usuario" });
  }
};

export {
  register,
  verifyAccount,
  login,
  forgotPassword,
  verifyPasswordResetToken,
  updatePassword,
  user,
  admin,
  userAccount,
};
