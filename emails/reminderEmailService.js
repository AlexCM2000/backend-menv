import { sendEmail } from "../config/nodeMailer.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fullName = (p) =>
  [p?.primerApellido, p?.segundoApellido, p?.nombres].filter(Boolean).join(" ");

const formatDate = (date) =>
  format(new Date(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

export const sendReminderEmail = async (appt) => {
  const emails = [
    ...new Set([appt.patient?.email, appt.user?.email].filter(Boolean)),
  ];
  if (!emails.length) return;

  const patientName =
    fullName(appt.patient) || fullName(appt.user) || "Paciente";
  const date = formatDate(appt.date);
  const time = appt.time;
  const doctorName = appt.doctor?.name;
  const doctorSpecialty = appt.doctor?.specialty;
  const healthName = appt.health?.name || "Centro de salud";
  const servicesList =
    (appt.services ?? []).map((s) => s.name).join(", ") || "—";

  await sendEmail({
    to: emails.join(", "),
    subject: `Recordatorio: Su cita médica es mañana a las ${time} — SIGMED-PA`,
    text: `Estimado/a ${patientName}, le recordamos que tiene una cita médica mañana ${date} a las ${time} en ${healthName}.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">

        <div style="background:#1e3a5f;padding:20px 28px;border-radius:10px 10px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">SIGMED-PA</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">
            Gobierno Autónomo Municipal de Puerto Acosta — La Paz, Bolivia
          </p>
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:28px;">

          <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;">⏰</span>
            <div>
              <p style="margin:0;font-weight:700;color:#854d0e;font-size:15px;">Recordatorio de cita médica</p>
              <p style="margin:4px 0 0;color:#92400e;font-size:13px;">Su cita es <strong>mañana</strong>. Por favor, preséntese a tiempo.</p>
            </div>
          </div>

          <p style="margin:0 0 20px;">Estimado/a <strong>${patientName}</strong>,</p>
          <p style="margin:0 0 20px;color:#555;">Le recordamos que tiene una cita médica programada para <strong>mañana</strong>. A continuación los detalles:</p>

          <table style="border-collapse:collapse;width:100%;margin:0 0 24px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr style="background:#f0f9ff;">
              <td style="padding:10px 14px;font-weight:700;width:40%;border-bottom:1px solid #e5e7eb;">📅 Fecha</td>
              <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${date}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb;">🕐 Hora</td>
              <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><strong>${time}</strong></td>
            </tr>
            <tr style="background:#f0f9ff;">
              <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb;">🏥 Centro de salud</td>
              <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">${healthName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb;">🩺 Servicio</td>
              <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">${servicesList}</td>
            </tr>
            ${
              doctorName
                ? `<tr style="background:#f0f9ff;">
                    <td style="padding:10px 14px;font-weight:700;">👨‍⚕️ Médico</td>
                    <td style="padding:10px 14px;">${doctorName}${doctorSpecialty ? ` — <em>${doctorSpecialty}</em>` : ""}</td>
                  </tr>`
                : ""
            }
          </table>

          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#166534;">
              ✅ <strong>Recomendaciones:</strong> Lleve su carnet de identidad y código SUS.
              Preséntese 10 minutos antes de su cita.
            </p>
          </div>

          <p style="color:#6b7280;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin:0;">
            Este es un mensaje automático del sistema SIGMED-PA. Si tiene alguna duda,
            comuníquese con el centro de salud directamente.<br>
            — Equipo SIGMED-PA
          </p>
        </div>

      </div>
    `,
  });
};
