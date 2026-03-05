import { createTransport } from "../config/nodeMailer.js";

export const sendEmailVerification=async({name,email,token})=>{   
    const transporter = createTransport(process.env.EMAIL_HOST,process.env.EMAIL_PORT,process.env.EMAIL_USER,process.env.EMAIL_PASS); 
    //enviar email
    const info = await transporter.sendMail({
        from: 'AppSalon <cuentas@gamea.com.bo>', // sender address
        to: email, // list of receivers
        subject: "confirma tu cuenta", // Subject line
        text: "AppSalon - confirma tu cuenta", // plain text body
        html: `<p>Hola: ${name}, confirma tu cuenta en GAMEA APP</p>
        <p> Tu cuenta esta casi lista, solo debes confirmar en el siguiente enlace<p/>
        <a href="${process.env.FRONTEND_URL}/auth/confirmar-cuenta/${token}" >Confirmar cuenta<a/>
        <p>Si tu no creaste esta cuenta, puedes ignorar este mensaje.<p/>`, // html body
    });
    console.log("Mensaje enviado: %s", info.messageId);
}

export const sendEmailPasswordReset=async({name,email,token})=>{   
    const transporter = createTransport(process.env.EMAIL_HOST,process.env.EMAIL_PORT,process.env.EMAIL_USER,process.env.EMAIL_PASS); 
    //enviar email
    const info = await transporter.sendMail({
        from: 'AppSalon <cuentas@gamea.com.bo>', // sender address
        to: email, // list of receivers
        subject: "Restablecer password", // Subject line
        text: "AppSalon - Restablecer password", // plain text body
        html: `<p>Hola: ${name}, solicitaste restablecer tu password en GAMEA APP</p>
        <p> sigue el siguiente enlace<p/>
        <a href="${process.env.FRONTEND_URL}/auth/olvide-password/${token}" >Restablecer password<a/>
        <p>Si tu no solicitaste esto, puedes ignorar este mensaje.<p/>`, // html body
    });
    console.log("Mensaje enviado: %s", info.messageId);
}