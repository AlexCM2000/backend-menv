import mongoose from "mongoose";
import  jwt from 'jsonwebtoken';
import { format } from "date-fns";
import { es } from 'date-fns/locale';

const validateObjectId = (id, res) => {
  //VALIDAR UN OBJECT ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("El id no es valido");
    return res.status(400).json({
      msg: error.message,
    });
  }
};

const handleNotFoundError = (message, res) => {
  const error = new Error(message);
  return res.status(404).json({
    msg: error.message,
  });
};

const uniqueId=()=>Date.now().toString(32)+Math.random().toString(32).substring(2)

const generateJWT = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });
};

const formatDate = (date) => {
  return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: es });
};

export { validateObjectId, handleNotFoundError,uniqueId,generateJWT,formatDate };
