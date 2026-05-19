/**
 * CDSS — Sistema de Soporte a la Decisión Clínica
 * Verifica alertas en signos vitales según umbrales configurables.
 * Retorna un array de { field, level, message }
 * level: "critico" | "advertencia" | "elevado"
 */

export const DEFAULT_VITAL_THRESHOLDS = {
  systolicBP: {
    label: "Presión sistólica",
    unit: "mmHg",
    critLow: 80,
    warnLow: 90,
    normalMin: 90,
    normalMax: 120,
    warnHigh: 140,
    critHigh: 180,
  },
  diastolicBP: {
    label: "Presión diastólica",
    unit: "mmHg",
    critLow: 50,
    warnLow: 60,
    normalMin: 60,
    normalMax: 80,
    warnHigh: 90,
    critHigh: 120,
  },
  heartRate: {
    label: "Frecuencia cardíaca",
    unit: "lpm",
    critLow: 40,
    warnLow: 60,
    normalMin: 60,
    normalMax: 100,
    warnHigh: 100,
    critHigh: 150,
  },
  temperature: {
    label: "Temperatura",
    unit: "°C",
    critLow: 34,
    warnLow: 36,
    normalMin: 36,
    normalMax: 37.6,
    warnHigh: 38.5,
    critHigh: 40,
  },
  oxygenSaturation: {
    label: "Saturación O₂",
    unit: "%",
    critLow: 85,
    warnLow: 90,
    normalMin: 95,
    normalMax: 100,
    warnHigh: null,
    critHigh: null,
  },
};

function evaluateVital(value, cfg) {
  const { label, unit, critLow, warnLow, normalMin, normalMax, warnHigh, critHigh } = cfg;

  if (critLow != null && value < critLow) {
    return {
      field: label,
      level: "critico",
      message: `${value} ${unit} — Valor crítico bajo (límite crítico: ${critLow} ${unit}). Atención inmediata.`,
    };
  }
  if (warnLow != null && value < warnLow) {
    return {
      field: label,
      level: "advertencia",
      message: `${value} ${unit} — Valor bajo (límite de advertencia: ${warnLow} ${unit}). Monitorear.`,
    };
  }
  if (critHigh != null && value >= critHigh) {
    return {
      field: label,
      level: "critico",
      message: `${value} ${unit} — Valor crítico alto (límite crítico: ${critHigh} ${unit}). Atención urgente.`,
    };
  }
  if (warnHigh != null && value >= warnHigh) {
    return {
      field: label,
      level: "advertencia",
      message: `${value} ${unit} — Valor elevado (límite de advertencia: ${warnHigh} ${unit}).`,
    };
  }
  if (normalMax != null && value > normalMax) {
    return {
      field: label,
      level: "elevado",
      message: `${value} ${unit} — Levemente elevado (rango normal: ≤ ${normalMax} ${unit}).`,
    };
  }
  if (normalMin != null && value < normalMin) {
    return {
      field: label,
      level: "elevado",
      message: `${value} ${unit} — Levemente bajo (rango normal: ≥ ${normalMin} ${unit}).`,
    };
  }
  return null;
}

/**
 * @param {object} vs - Objeto con los signos vitales registrados
 * @param {object} [configThresholds] - Umbrales desde BD. Si se omite, usa DEFAULT_VITAL_THRESHOLDS.
 */
export const checkVitalSignAlerts = (vs, configThresholds) => {
  const thresholds = configThresholds ?? DEFAULT_VITAL_THRESHOLDS;
  const alerts = [];

  const fields = ["systolicBP", "diastolicBP", "heartRate", "temperature", "oxygenSaturation"];
  for (const field of fields) {
    const value = vs[field];
    if (value !== null && value !== undefined && thresholds[field]) {
      const alert = evaluateVital(value, thresholds[field]);
      if (alert) alerts.push(alert);
    }
  }

  return alerts;
};
