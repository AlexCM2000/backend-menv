import CdssConfig from "../models/CdssConfig.js";
import { DEFAULT_VITAL_THRESHOLDS } from "../utils/cdss.js";

const VITAL_KEYS = ["systolicBP", "diastolicBP", "heartRate", "temperature", "oxygenSaturation"];
const THRESHOLD_KEYS = ["critLow", "warnLow", "normalMin", "normalMax", "warnHigh", "critHigh"];

export const getConfig = async (req, res) => {
  try {
    const config = await CdssConfig.getOrCreate();
    return res.json(config);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener configuración CDSS." });
  }
};

export const updateConfig = async (req, res) => {
  if (!req.user?.admin) {
    return res.status(403).json({ message: "Solo el administrador puede modificar la configuración CDSS." });
  }
  try {
    const { vitalSigns } = req.body;
    const config = await CdssConfig.getOrCreate();

    if (vitalSigns) {
      for (const vKey of VITAL_KEYS) {
        if (vitalSigns[vKey]) {
          for (const tKey of THRESHOLD_KEYS) {
            if (vitalSigns[vKey][tKey] !== undefined) {
              config.vitalSigns[vKey][tKey] = vitalSigns[vKey][tKey] ?? null;
            }
          }
        }
      }
    }

    config.updatedBy = req.user._id;
    config.markModified("vitalSigns");
    await config.save();

    return res.json({ message: "Configuración CDSS actualizada.", config });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al actualizar configuración CDSS." });
  }
};

export const resetConfig = async (req, res) => {
  if (!req.user?.admin) {
    return res.status(403).json({ message: "Solo el administrador puede restablecer la configuración CDSS." });
  }
  try {
    const config = await CdssConfig.getOrCreate();
    for (const vKey of VITAL_KEYS) {
      config.vitalSigns[vKey] = { ...DEFAULT_VITAL_THRESHOLDS[vKey] };
    }
    config.updatedBy = req.user._id;
    config.markModified("vitalSigns");
    await config.save();

    return res.json({ message: "Configuración CDSS restablecida a valores por defecto.", config });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al restablecer configuración CDSS." });
  }
};
