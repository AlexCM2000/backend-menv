import cron from "node-cron";
import colors from "colors";
import Appointment from "../models/Appointment.js";
import { sendReminderEmail } from "../emails/reminderEmailService.js";

const runReminderJob = async () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setUTCHours(23, 59, 59, 999);

  let appointments;
  try {
    appointments = await Appointment.find({
      date: { $gte: tomorrow, $lte: tomorrowEnd },
      state: { $in: ["Pendiente", "Reprogramada"] },
    })
      .populate("patient", "primerApellido segundoApellido nombres email")
      .populate("user", "primerApellido segundoApellido nombres email")
      .populate("doctor", "name specialty")
      .populate("health", "name")
      .populate("services", "name")
      .lean();
  } catch (err) {
    console.error(colors.red("[Recordatorio] Error consultando citas:"), err.message);
    return;
  }

  console.log(
    colors.cyan(`[Recordatorio] ${appointments.length} cita(s) para mañana — enviando recordatorios...`)
  );

  let enviados = 0;
  let omitidos = 0;

  for (const appt of appointments) {
    const tieneEmail = appt.patient?.email || appt.user?.email;
    if (!tieneEmail) {
      omitidos++;
      continue;
    }
    try {
      await sendReminderEmail(appt);
      enviados++;
    } catch (err) {
      console.error(
        colors.yellow(`[Recordatorio] Error en cita ${appt._id}:`),
        err.message
      );
    }
  }

  console.log(
    colors.green(`[Recordatorio] Enviados: ${enviados} | Sin email: ${omitidos}`)
  );
};

export const scheduleReminderJob = () => {
  // Ejecuta todos los días a las 8:00 AM hora Bolivia (America/La_Paz = UTC-4)
  cron.schedule("0 8 * * *", runReminderJob, {
    timezone: "America/La_Paz",
  });
  console.log(
    colors.blue("[Recordatorio] Cron activado — recordatorios a las 8:00 AM hora Bolivia")
  );
};
