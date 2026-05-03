// controllers/authController.js

import User from "../models/User.js";
import HealthCenter from "../models/HealthCenter.js";
import Patient from "../models/Patient.js";
import HealthRecord from "../models/HealthRecord.js";
import AuditLog from "../models/AuditLog.js";
import { crearAuditLog } from "../utils/auditHelper.js";
import {
  sendEmailPasswordReset,
  sendEmailVerification,
} from "../emails/authEmailService.js";
import { generateJWT, uniqueId } from "../utils/index.js";
import Sus from "../models/Sus.js";

const register = async (req, res) => {
  const { email: correo, password, primerApellido, segundoApellido, nombres, codigo, susCode } = req.body;

  // 1) Todos los campos obligatorios
  if (![correo, password, primerApellido, nombres, codigo, susCode].every(Boolean)) {
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
      primerApellido,
      segundoApellido: segundoApellido || "",
      nombres,
      email: correo,
      password,
      health: health._id,
      susCode,
    });
    const saved = await newUser.save();
    const fullName = [saved.primerApellido, saved.segundoApellido, saved.nombres].filter(Boolean).join(" ");
    console.log(`[Email] Intentando enviar verificación a: ${saved.email} desde: ${process.env.EMAIL_FROM}`);
    try {
      await sendEmailVerification({
        name: fullName,
        email: saved.email,
        token: saved.token,
      });
      console.log(`[Email] Verificación enviada correctamente a: ${saved.email}`);
    } catch (emailErr) {
      console.error(`[Email] Error al enviar verificación a ${saved.email}:`, emailErr.message || emailErr);
      saved.verified = true;
      saved.token = "";
      await saved.save();
      console.warn(`[Email] Usuario auto-verificado por fallo SMTP: ${saved.email}`);
    }

    // Auto-crear o vincular ficha de paciente + historial clínico (no bloqueante)
    try {
      const existingPatient = await Patient.findOne({ susCode, eliminado_en: null });
      if (existingPatient) {
        // Ya existe una ficha manual: solo vincular el usuario
        existingPatient.user = saved._id;
        await existingPatient.save();
      } else {
        // No existe ficha: crear paciente + historial
        const patient = new Patient({
          primerApellido,
          segundoApellido: segundoApellido || "",
          nombres,
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
      }
    } catch (autoErr) {
      console.error("Error al crear/vincular historial automático:", autoErr);
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
    user.passwordResetExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
    await user.save();
    const fullName = [user.primerApellido, user.segundoApellido, user.nombres].filter(Boolean).join(" ");
    await sendEmailPasswordReset({
      name: fullName,
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
  if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
    user.token = "";
    user.passwordResetExpires = null;
    await user.save();
    return res.status(401).json({ msg: "El enlace de recuperación ha expirado. Solicita uno nuevo." });
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
  if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
    user.token = "";
    user.passwordResetExpires = null;
    await user.save();
    return res.status(401).json({ msg: "El enlace de recuperación ha expirado. Solicita uno nuevo." });
  }
  try {
    user.password = password;
    user.token = "";
    user.passwordResetExpires = null;
    await user.save();

    crearAuditLog({
      action:      "password_reset",
      performedBy: user,
      targetUser:  user,
      description: `Contraseña restablecida vía enlace de recuperación para ${user.email}`,
      ip:          null,
    });

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

const updateProfile = async (req, res) => {
  const { primerApellido, segundoApellido, nombres, email } = req.body;

  if (!primerApellido || !nombres || !email) {
    return res.status(400).json({ msg: "Primer apellido, nombres y email son obligatorios" });
  }

  try {
    const authUser = req.user;

    // Verificar que el email no esté en uso por otro usuario
    if (email !== authUser.email) {
      const existing = await User.findOne({ email, _id: { $ne: authUser._id } });
      if (existing) {
        return res.status(400).json({ msg: "El email ya está en uso por otro usuario" });
      }
    }

    authUser.primerApellido = primerApellido.trim();
    authUser.segundoApellido = segundoApellido?.trim() ?? "";
    authUser.nombres = nombres.trim();
    authUser.email = email.trim().toLowerCase();
    await authUser.save();

    return res.json({ msg: "Perfil actualizado correctamente", user: authUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al actualizar el perfil" });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }
  if (newPassword.trim().length < 8) {
    return res.status(400).json({ msg: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  try {
    // Re-fetch con contraseña para poder verificarla (req.user excluye password)
    const authUser = await User.findById(req.user._id);
    const isMatch = await authUser.checkPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ msg: "La contraseña actual es incorrecta" });
    }

    authUser.password = newPassword;
    await authUser.save();

    crearAuditLog({
      action:      "password_reset",
      performedBy: req.user,
      targetUser:  req.user,
      description: `Contraseña cambiada desde el perfil por ${req.user.email}`,
      ip:          req.ip,
    });

    return res.json({ msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error al cambiar la contraseña" });
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
  updateProfile,
  changePassword,
};
