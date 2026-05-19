import mongoose from "mongoose";

const stockSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["antibiótico", "analgésico", "antihipertensivo", "antidiabético", "vitamina", "otro"],
      required: true,
    },
    pharmaceuticalForm: {
      type: String,
      enum: ["comprimido", "cápsula", "jarabe", "inyectable", "crema"],
      required: true,
    },
    unit: {
      type: String,
      enum: ["comprimidos", "ml", "frascos"],
      required: true,
    },
    availableQuantity: { type: Number, default: 0, min: 0 },
    minimumQuantity: { type: Number, required: true, min: 0 },
    health: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Health",
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Stock = mongoose.model("Stock", stockSchema);
export default Stock;
