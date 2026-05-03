import { sendEmail } from "../config/nodeMailer.js";

const buildRecipients = (...emails) => emails.filter(Boolean).join(", ");

export const sendEmailNewAppointment = async ({
  date, time, userEmail, userName, doctorEmail, doctorName,
}) => {
  const to = buildRecipients(userEmail, doctorEmail);
  if (!to) return;
  await sendEmail({
    to,
    subject: `Nueva cita confirmada — ${date} a las ${time}`,
    text: `Nueva cita confirmada para el ${date} a las ${time}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">✅ Cita confirmada</h2>
        ${userName ? `<p>Hola <strong>${userName}</strong>,</p>` : "<p>Estimado/a paciente,</p>"}
        <p>Tu cita ha sido registrada exitosamente.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background:#f0f9ff;">
            <td style="padding:8px 12px; font-weight:bold;">Fecha</td>
            <td style="padding:8px 12px;">${date}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; font-weight:bold;">Hora</td>
            <td style="padding:8px 12px;">${time}</td>
          </tr>
          ${doctorName ? `<tr style="background:#f0f9ff;"><td style="padding:8px 12px; font-weight:bold;">Médico</td><td style="padding:8px 12px;">${doctorName}</td></tr>` : ""}
        </table>
        <p style="color:#666; font-size:13px;">Si no agendaste esta cita, por favor contáctanos.</p>
        <p style="color:#666;">— Equipo SIGMED-PA</p>
      </div>
    `,
  });
};

export const sendEmailUpdateAppointment = async ({
  date, time, userEmail, userName, doctorEmail, doctorName,
}) => {
  const to = buildRecipients(userEmail, doctorEmail);
  if (!to) return;
  await sendEmail({
    to,
    subject: `Cita actualizada — ${date} a las ${time}`,
    text: `Tu cita ha sido actualizada para el ${date} a las ${time}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #d97706;">📝 Cita actualizada</h2>
        ${userName ? `<p>Hola <strong>${userName}</strong>,</p>` : "<p>Estimado/a paciente,</p>"}
        <p>Los datos de tu cita han sido actualizados.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background:#fffbeb;">
            <td style="padding:8px 12px; font-weight:bold;">Nueva fecha</td>
            <td style="padding:8px 12px;">${date}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; font-weight:bold;">Nueva hora</td>
            <td style="padding:8px 12px;">${time}</td>
          </tr>
          ${doctorName ? `<tr style="background:#fffbeb;"><td style="padding:8px 12px; font-weight:bold;">Médico</td><td style="padding:8px 12px;">${doctorName}</td></tr>` : ""}
        </table>
        <p style="color:#666; font-size:13px;">Si no reconoces este cambio, por favor contáctanos.</p>
        <p style="color:#666;">— Equipo SIGMED-PA</p>
      </div>
    `,
  });
};

export const sendEmailDeleteAppointment = async ({
  date, time, userEmail, userName, doctorEmail, doctorName,
}) => {
  const to = buildRecipients(userEmail, doctorEmail);
  if (!to) return;
  await sendEmail({
    to,
    subject: `Cita cancelada — ${date} a las ${time}`,
    text: `Tu cita del ${date} a las ${time} ha sido cancelada.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #dc2626;">❌ Cita cancelada</h2>
        ${userName ? `<p>Hola <strong>${userName}</strong>,</p>` : "<p>Estimado/a paciente,</p>"}
        <p>Tu cita ha sido cancelada.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="background:#fef2f2;">
            <td style="padding:8px 12px; font-weight:bold;">Fecha</td>
            <td style="padding:8px 12px;">${date}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; font-weight:bold;">Hora</td>
            <td style="padding:8px 12px;">${time}</td>
          </tr>
          ${doctorName ? `<tr style="background:#fef2f2;"><td style="padding:8px 12px; font-weight:bold;">Médico</td><td style="padding:8px 12px;">${doctorName}</td></tr>` : ""}
        </table>
        <p style="color:#666; font-size:13px;">Si necesitas reagendar, ingresa a la plataforma.</p>
        <p style="color:#666;">— Equipo SIGMED-PA</p>
      </div>
    `,
  });
};
