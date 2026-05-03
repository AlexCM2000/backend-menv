// Usa Brevo REST API en lugar de SMTP para evitar bloqueos de puertos en hosting
export const sendEmail = async ({ to, subject, text, html }) => {
  const recipients = String(to)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  if (!recipients.length) return;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.EMAIL_PASS,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SIGMED-PA", email: process.env.EMAIL_FROM },
      to: recipients,
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  return res.json();
};
