
import {createTransport } from "../config/nodeMailer.js"

export const sendEmailNewAppointment=async({
    date,time
})=>{
    const transporter = createTransport(process.env.EMAIL_HOST,process.env.EMAIL_PORT,process.env.EMAIL_USER,process.env.EMAIL_PASS)
   
    //ENVIAR EMAIL
    const info = await transporter.sendMail({
        from: "GAMPA <citas@appsalon.com>",
        to: "admin@appsalon.com",
        subject: "App GAMPA - nueva cita",
        text: "nueva cita :)",
        html: `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmation</title>
    </head>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Appointment Confirmation</h2>
            <p style="color: #666;">Dear Customer,</p>
            <p style="color: #666;">Your appointment has been confirmed.</p>
            <p style="color: #666;">Date: ${date}</p>
            <p style="color: #666;">Time: ${time}</p>
            <p style="color: #666;">Thank you for choosing our service.</p>
            <p style="color: #666;">Best regards,</p>
            <p style="color: #666;">The Clinic Team</p>
        </div>
    </body>
    </html>
    `
    })
     
}

export const sendEmailUpdateAppointment=async({
    date,time
})=>{
    const transporter = createTransport(process.env.EMAIL_HOST,process.env.EMAIL_PORT,process.env.EMAIL_USER,process.env.EMAIL_PASS)
   
    //ENVIAR EMAIL
    const info = await transporter.sendMail({
        from: "GAMPA <citas@appsalon.com>",
        to: "admin@appsalon.com",
        subject: "App GAMPA - cita actualizada",
        text: " cita actualizada :)",
        html: `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmation</title>
    </head>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Hi admin , appointment has updated</h2>
            <p style="color: #666;">Dear Customer,</p>
            <p style="color: #666;">Your appointment has been updated.</p>
            <p style="color: #666;">Date: ${date}</p>
            <p style="color: #666;">Time: ${time}</p>
            <p style="color: #666;">Thank you for choosing our service.</p>
            <p style="color: #666;">Best regards,</p>
            <p style="color: #666;">The Clinic Team</p>
        </div>
    </body>
    </html>
    `
    })
     
}

export const sendEmailDeleteAppointment=async({
    date,time
})=>{
    const transporter = createTransport(process.env.EMAIL_HOST,process.env.EMAIL_PORT,process.env.EMAIL_USER,process.env.EMAIL_PASS)
   
    //ENVIAR EMAIL
    const info = await transporter.sendMail({
        from: "GAMPA <citas@appsalon.com>",
        to: "admin@appsalon.com",
        subject: "App GAMPA - cita eliminada",
        text: " cita eliminada :(",
        html:   `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmation</title>
    </head>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Hi admin , appointment has deleted</h2>
            <p style="color: #666;">Dear Customer,</p>
            <p style="color: #666;">Your appointment has been deleted.</p>
            <p style="color: #666;">Date: ${date}</p>
            <p style="color: #666;">Time: ${time}</p>
            <p style="color: #666;">Thank you for choosing our service.</p>
            <p style="color: #666;">Best regards,</p>
            <p style="color: #666;">The Clinic Team</p>
        </div>
    </body>
    </html>
    `
    })
     
}