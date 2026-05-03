import nodemailer from "nodemailer";

export const createTransport = (host, port, user, pass) => {
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: false,
    auth: { user, pass },
  });
}