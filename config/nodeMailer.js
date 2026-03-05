import nodemailer from "nodemailer";

export const createTransport =(host,port,user,pass)=>{

    return  nodemailer.createTransport({
        host ,
        port,
        auth: {
          user,
          pass,
        },
      });
}