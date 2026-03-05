import mongoose from "mongoose";

const healthSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  codigo: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
 
});

const Sus = mongoose.model("Sus", healthSchema);
export default Sus;
