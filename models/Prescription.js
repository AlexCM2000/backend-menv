import mongoose from "mongoose";

const prescriptionItemSchema = mongoose.Schema({
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stock",
    required: true,
  },
  medicationName: { type: String, required: true },
  dose: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String, required: true },
  quantityToDispense: { type: Number, required: true, min: 1 },
  quantityDispensed: { type: Number, default: 0 },
  dispensed: { type: Boolean, default: false },
  dispensedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  dispensedAt: { type: Date, default: null },
});

const prescriptionSchema = mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["Pendiente", "Despachada", "Parcial"],
      default: "Pendiente",
    },
    health: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Health",
      required: true,
    },
    items: [prescriptionItemSchema],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const Prescription = mongoose.model("Prescription", prescriptionSchema);
export default Prescription;
