import mongoose from "mongoose";
import { DEFAULT_VITAL_THRESHOLDS } from "../utils/cdss.js";

const thresholdSchema = new mongoose.Schema(
  {
    label:     { type: String },
    unit:      { type: String },
    critLow:   { type: Number, default: null },
    warnLow:   { type: Number, default: null },
    normalMin: { type: Number, default: null },
    normalMax: { type: Number, default: null },
    warnHigh:  { type: Number, default: null },
    critHigh:  { type: Number, default: null },
  },
  { _id: false }
);

const CdssConfigSchema = new mongoose.Schema(
  {
    vitalSigns: {
      systolicBP:       { type: thresholdSchema, default: () => ({ ...DEFAULT_VITAL_THRESHOLDS.systolicBP }) },
      diastolicBP:      { type: thresholdSchema, default: () => ({ ...DEFAULT_VITAL_THRESHOLDS.diastolicBP }) },
      heartRate:        { type: thresholdSchema, default: () => ({ ...DEFAULT_VITAL_THRESHOLDS.heartRate }) },
      temperature:      { type: thresholdSchema, default: () => ({ ...DEFAULT_VITAL_THRESHOLDS.temperature }) },
      oxygenSaturation: { type: thresholdSchema, default: () => ({ ...DEFAULT_VITAL_THRESHOLDS.oxygenSaturation }) },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Singleton: devuelve el documento único, creándolo con defaults si no existe.
CdssConfigSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ vitalSigns: DEFAULT_VITAL_THRESHOLDS });
  }
  return doc;
};

export default mongoose.model("CdssConfig", CdssConfigSchema);
