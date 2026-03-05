import mongoose from "mongoose";

const healthSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  codigo: {
    type: Number,
    required: true,
    trim: true,
  },
  departamento: {
    type: String,
    required: true,
    trim: true,
  },
  municipio: {
    type: String,
    required: true,
    trim: true,
  },
  nivel:{
    type: Number,
    required: true,
    trim: true,
  },
  direccion: {
    type: String,
    required: true,
    trim: true,
  },
});

const Health = mongoose.model("Health", healthSchema);
export default Health;
