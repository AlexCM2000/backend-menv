import { sendEmail } from "../config/nodeMailer.js";

export const sendEmailVerification = async ({ name, email, token }) => {
  await sendEmail({
    to: email,
    subject: `Bienvenido/a a SIGMED-PA, ${name}`,
    text: `Hola ${name}, tu registro en SIGMED-PA fue recibido. Activa tu cuenta en: ${process.env.FRONTEND_URL}/auth/confirmar-cuenta/${token}`,
    html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
          <h2 style="color:#2563eb;">Bienvenido/a a SIGMED-PA</h2>
          <p>Hola <strong>${name}</strong>,</p>
          <p>Tu registro fue recibido correctamente. Para activar tu cuenta y comenzar a usar el sistema, haz clic en el botón:</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL}/auth/confirmar-cuenta/${token}"
               style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              Activar cuenta
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Si no realizaste este registro, puedes ignorar este mensaje.</p>
          <p style="color:#666;">— Equipo SIGMED-PA</p>
        </div>`,
  });
};

export const sendEmailPasswordReset = async ({ name, email, token }) => {
  await sendEmail({
    to: email,
    subject: "Restablecer contraseña — SIGMED-PA",
    text: `Hola ${name}, recibimos una solicitud para restablecer tu contraseña en el SIGMED-PA. El enlace es válido por 2 horas.`,
    html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
          <h2 style="color:#d97706;"> Restablecer contraseña</h2>
          <p>Hola <strong>${name}</strong>,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en el <strong>SIGMED-PA</strong>.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL}/auth/olvide-password/${token}"
               style="background:#d97706;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              Restablecer contraseña
            </a>
          </p>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              ⏰ <strong>Este enlace es válido por 2 horas</strong> a partir de la recepción de este correo.
              Pasado ese tiempo deberás solicitar un nuevo enlace.
            </p>
          </div>
          <p style="color:#666;font-size:13px;">Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña no será modificada.</p>
          <p style="color:#666;">— Equipo SIGMED-PA</p>
        </div>`,
  });
};
