import dotenv from "dotenv";
import { db } from "../config/db.js";
import Health from "../models/HealthCenter.js";
import Sus from "../models/Sus.js";
import Category from "../models/Category.js";
import Services from "../models/Services.js";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import DoctorSchedule from "../models/DoctorSchedule.js";
import Patient from "../models/Patient.js";
import HealthRecord from "../models/HealthRecord.js";
import Appointment from "../models/Appointment.js";
import Stock from "../models/Stock.js";
import Prescription from "../models/Prescription.js";
import colors from "colors";

dotenv.config();
await db();

// ─────────────────── HELPERS ───────────────────
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const ri    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const rDate = (from, to) =>
  new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));

// Solo genera fechas lunes–viernes
const rWeekday = (from, to) => {
  let d;
  do { d = rDate(from, to); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
};

// Estado lógico según si la fecha ya pasó o es futura
const aptState = (date) => {
  const now = new Date();
  if (date < now) return pick(["Completada","Completada","Completada","Completada","Completada","Cancelada","Cancelada","No asistio"]);
  return pick(["Pendiente","Pendiente","Pendiente","Pendiente","Reprogramada"]);
};

let _susSeq   = 10_000_000;
let _emailSeq = 0;
const nextSus = ()       => String(++_susSeq);
const mkEmail = (prefix) => { _emailSeq++; return `${prefix.toLowerCase()}${_emailSeq}@sigmed.bo`; };

// ─────────────────── DATOS ESTÁTICOS ───────────────────
const APELLIDOS = [
  "Mamani","Condori","Quispe","Flores","Cruz","Gutierrez","Vargas","Lopez",
  "Garcia","Ramos","Apaza","Choque","Lima","Poma","Tito","Cori","Espinoza",
  "Layme","Paucara","Huanca","Ticona","Colque","Tarqui","Quelca","Marca",
  "Nina","Copa","Vilca","Sirpa","Chua","Aruquipa","Callisaya","Zenteno",
  "Morales","Miranda","Rojas","Aguilar","Salinas","Mendez","Alvarado",
];

const NOMBRES_M = [
  "Juan","Carlos","Pedro","Luis","Miguel","Jorge","Roberto","Ricardo",
  "Fernando","Oscar","Daniel","Mario","Gonzalo","Edwin","Rene","Nelson",
  "Hugo","Rodrigo","Walter","Ivan","Freddy","Leonardo","Enrique","Gustavo",
  "Ernesto","Ramon","Isaias","Jhon","Marcos","Pablo","Raul","Victor","Hector",
  "Santiago","Emmanuel","Javier","Nicolas","Sebastian","Alejandro","David",
];

const NOMBRES_F = [
  "Maria","Rosa","Ana","Carmen","Lucia","Patricia","Sandra","Monica",
  "Elena","Cecilia","Adriana","Yolanda","Beatriz","Elizabeth","Lorena",
  "Silvia","Gloria","Martha","Jenny","Sonia","Ingrid","Carla","Sofia",
  "Natalia","Valeria","Daniela","Paola","Claudia","Miriam","Fernanda",
  "Alejandra","Veronica","Gabriela","Andrea","Pamela","Diana","Fabiola",
  "Karina","Roxana","Melina",
];

const SPECIALTIES = [
  "Medicina General","Pediatría","Ginecología y Obstetricia",
  "Odontología","Cardiología","Radiología","Traumatología",
  "Dermatología","Neurología","Endocrinología",
];

const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

const TIMES = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00",
];

const RELATIONSHIPS = ["Padre","Madre","Cónyuge","Hermano/a","Hijo/a","Tío/a"];
const CONDITIONS    = ["Hipertensión arterial","Diabetes tipo 2","Asma bronquial","Sin antecedentes"];
const ALLERGIES_OPT = ["Penicilina","Sulfas","Polen","AINE","Sin alergias conocidas"];

// ── Diagnósticos CIE-10 con notas clínicas realistas
const DIAGNOSES = [
  {
    code: "J00",
    description: "Rinofaringitis aguda (resfriado común)",
    notes: "Cuadro de 3 días de evolución. Paciente con rinorrea hialina, estornudos y malestar general. Temperatura 37.6°C. Orofaringe hiperémica sin exudados. Se indica tratamiento sintomático y reposo relativo por 48 horas.",
  },
  {
    code: "J06.9",
    description: "Infección aguda de vías respiratorias superiores",
    notes: "Paciente presenta irritación faríngea intensa, fiebre 38.1°C y adenopatías cervicales dolorosas bilaterales. Se inicia antibioticoterapia empírica y analgesia. Control en 5 días.",
  },
  {
    code: "A09",
    description: "Diarrea y gastroenteritis",
    notes: "Cuadro de 2 días de evolución con deposiciones líquidas en 5-6 oportunidades/día, náuseas y dolor abdominal tipo cólico. Sin sangre ni moco. Signos de deshidratación leve. Se indica hidratación oral y dieta astringente.",
  },
  {
    code: "K29",
    description: "Gastritis y duodenitis",
    notes: "Paciente con epigastralgia de 1 semana de evolución, ardor retroesternal postprandial y pirosis. Sin hematemesis. Se indica Omeprazol 20mg en ayunas y dieta sin irritantes. Control en 3 semanas.",
  },
  {
    code: "J18",
    description: "Neumonía",
    notes: "Paciente con tos productiva de 8 días de evolución, fiebre 38.8°C y dolor pleurítico en hemitórax derecho. A la auscultación: crepitantes basales derechos. Rx tórax: opacidad en lóbulo inferior derecho. Se inicia antibioticoterapia y se indica control en 48 horas.",
  },
  {
    code: "E11",
    description: "Diabetes mellitus tipo 2",
    notes: "Paciente diabético en seguimiento trimestral. Glucemia basal 156 mg/dL. Refiere poliuria y polidipsia moderada. IMC 28.4. Se ajusta dosis de Metformina y se solicita HbA1c. Próximo control en 4 semanas.",
  },
  {
    code: "I10",
    description: "Hipertensión esencial",
    notes: "Paciente hipertenso con TA 160/100 mmHg en consulta. Refiere cefalea occipital de 2 días. Sin déficit neurológico focal. Se ajusta antihipertensivo y se indica monitoreo domiciliario. Retorno urgente si TA > 180/110.",
  },
  {
    code: "M54",
    description: "Dorsalgia / Lumbalgia",
    notes: "Dolor lumbar de 5 días de evolución de intensidad 7/10. Contractura paravertebral bilateral sin irradiación a MMII. Lasègue negativo. Se indica AINE, relajante muscular y fisioterapia. Reposo relativo 48-72 horas.",
  },
  {
    code: "Z34",
    description: "Supervisión de embarazo normal",
    notes: "Control prenatal, semana gestacional 28. Altura uterina 26 cm acorde a EG. FCF 142 lpm. Movimientos fetales activos. TA 110/70 mmHg. Hb 11.2 g/dL. Se solicita ecografía obstétrica. Próximo control en 4 semanas.",
  },
  {
    code: "E46",
    description: "Desnutrición proteicocalórica",
    notes: "Paciente pediátrico con P/E en percentil 3. Palidez cutánea marcada. Apetito reducido según madre. Se indica suplemento nutricional, controles de peso semanales y derivación a nutricionista.",
  },
  {
    code: "B50",
    description: "Paludismo por Plasmodium falciparum",
    notes: "Paciente con cuadro febril de 4 días de evolución, escalofríos, cefalea intensa y artralgias. Frotis de gota gruesa positivo para P. falciparum. Se inicia tratamiento según protocolo nacional y se notifica al SEDES.",
  },
  {
    code: "F32",
    description: "Episodio depresivo",
    notes: "Paciente refiere ánimo deprimido de más de 2 semanas, insomnio, pérdida del apetito y anhedonia. Sin ideación suicida activa. Se inicia abordaje psicosocial y se deriva a psicología. Control en 2 semanas.",
  },
  {
    code: "J45",
    description: "Asma bronquial",
    notes: "Paciente asmático con exacerbación leve. Sibilancias espiratorias bilaterales. SpO2 94%. Se administra broncodilatador de rescate con buena respuesta. Se refuerza técnica inhalatoria y plan de acción.",
  },
  {
    code: "N39.0",
    description: "Infección de vías urinarias",
    notes: "Paciente femenino con disuria, poliaquiuria y urgencia miccional de 3 días. Sedimento urinario: leucocituria ++, bacteriuria +. Sin fiebre ni dolor lumbar. Se indica tratamiento antibiótico empírico por 7 días y urocultivo de control.",
  },
  {
    code: "K92",
    description: "Hemorragia gastrointestinal no especificada",
    notes: "Paciente con melenas de 2 días de evolución. Hemoglobina 9.8 g/dL. PA 100/60 mmHg, FC 96 lpm. Se indica ayuno, hidratación IV y derivación urgente a segundo nivel para endoscopía.",
  },
];

// ── Observaciones clínicas estilo médico
const OBSERVATIONS = [
  "Se realiza examen físico completo. Paciente consciente, orientado en tiempo y espacio, bien hidratado. No se evidencian signos de alarma. Se indica tratamiento y retorno en 7 días.",
  "Paciente refiere mejoría parcial respecto a consulta anterior. Persiste leve sintomatología residual. Se continúa tratamiento y se agrega terapia complementaria.",
  "Se solicita hemograma completo, glucemia en ayunas y perfil lipídico para próximo control. Paciente acepta y comprende indicaciones.",
  "Paciente cumple con tratamiento indicado. Buena respuesta clínica. Se mantiene medicación por 7 días más y se programa control.",
  "Se explican signos de alarma al paciente y acompañante: fiebre > 38.5°C, dificultad respiratoria, pérdida de consciencia. Comprende y se compromete a acudir de urgencia si se presentan.",
  "Se indica reposo relativo por 48-72 horas, dieta blanda, abundante líquido oral. Analgesia de rescate según necesidad. Sin alcohol ni tabaco durante el tratamiento.",
  "Control prenatal dentro de parámetros normales. Paciente con buena adherencia a controles. Próximo control en 4 semanas. Se refuerza consejería nutricional.",
  "TA controlada. Se mantiene medicación antihipertensiva con buena tolerancia. Se recuerda importancia de no suspender tratamiento. Monitoreo domiciliario 2x/día.",
  "Paciente diabético con glucemia basal 148 mg/dL. Se reitera importancia de dieta y actividad física. Se ajusta dosis de Metformina. Control con HbA1c en próxima consulta.",
  "Se realiza examen de zona afectada. Sin signos de infección secundaria. Se indica tratamiento tópico y medidas de higiene. Retorno si no mejora en 72 horas.",
  "Se indica derivación a especialidad correspondiente para evaluación complementaria. Se explica procedimiento al paciente. Se confecciona hoja de referencia.",
  "Paciente con evolución favorable. Alta provisional con indicaciones escritas. Se programa control en 1 mes o antes según evolución.",
  "Vacunas al día según PAI. No se evidencian reacciones postvacunales. Se registra en carnet de vacunación. Próxima vacuna según esquema.",
  "Control de niño sano. Peso y talla dentro de percentiles normales. Desarrollo psicomotor acorde a la edad. Lactancia materna exclusiva adecuada.",
  "Paciente refiere buena adherencia terapéutica. Se realiza ajuste de dosis según respuesta clínica y laboratorial. Próximo control en 3 meses.",
];

// ── Catálogo de medicamentos para Stock (por centro)
const STOCK_CATALOG = [
  { name: "Amoxicilina 500mg",      category: "antibiótico",      pharmaceuticalForm: "cápsula",    unit: "comprimidos", minimumQuantity: 20 },
  { name: "Paracetamol 500mg",      category: "analgésico",       pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 30 },
  { name: "Ibuprofeno 400mg",       category: "analgésico",       pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 20 },
  { name: "Metformina 500mg",       category: "antidiabético",    pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 25 },
  { name: "Enalapril 5mg",          category: "antihipertensivo", pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 20 },
  { name: "Amlodipino 5mg",         category: "antihipertensivo", pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 15 },
  { name: "Omeprazol 20mg",         category: "otro",             pharmaceuticalForm: "cápsula",    unit: "comprimidos", minimumQuantity: 15 },
  { name: "Azitromicina 500mg",     category: "antibiótico",      pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 10 },
  { name: "Metronidazol 250mg",     category: "antibiótico",      pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 10 },
  { name: "Ciprofloxacino 500mg",   category: "antibiótico",      pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 10 },
  { name: "Vitamina C 500mg",       category: "vitamina",         pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 30 },
  { name: "Sulfato ferroso 300mg",  category: "vitamina",         pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 20 },
  { name: "Ácido fólico 5mg",       category: "vitamina",         pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 20 },
  { name: "Atorvastatina 20mg",     category: "otro",             pharmaceuticalForm: "comprimido", unit: "comprimidos", minimumQuantity: 15 },
  { name: "Dexametasona 4mg",       category: "otro",             pharmaceuticalForm: "inyectable", unit: "ml",          minimumQuantity: 5  },
  { name: "Diclofenaco 75mg",       category: "analgésico",       pharmaceuticalForm: "inyectable", unit: "ml",          minimumQuantity: 5  },
  { name: "Amoxicilina 250mg/5ml",  category: "antibiótico",      pharmaceuticalForm: "jarabe",     unit: "frascos",     minimumQuantity: 5  },
  { name: "Paracetamol 120mg/5ml",  category: "analgésico",       pharmaceuticalForm: "jarabe",     unit: "frascos",     minimumQuantity: 5  },
];

// ── Datos para ítems de receta
const RX_DOSES = [
  "1 comprimido", "2 comprimidos", "1/2 comprimido",
  "5 ml", "10 ml", "1 ampolla", "1 frasco",
];
const RX_FREQUENCIES = [
  "cada 6 horas", "cada 8 horas", "cada 12 horas", "cada 24 horas",
  "1 vez al día", "2 veces al día", "3 veces al día",
];
const RX_DURATIONS = [
  "3 días", "5 días", "7 días", "10 días", "14 días", "21 días", "30 días",
];
const RX_NOTES = [
  "Tomar con alimentos. Completar el tratamiento completo.",
  "No suspender sin indicación médica.",
  "Administrar en ayunas. Evitar bebidas alcohólicas durante el tratamiento.",
  "Vigilar posibles reacciones adversas e informar al médico.",
  "",
  "",
];

let _rxSeq = 0;
const nextRxCode = (date) => {
  _rxSeq++;
  const d = date ?? new Date();
  const dp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `RX-${dp}-${String(_rxSeq).padStart(5, "0")}`;
};

// ── Tratamientos previos
const PREV_TREATMENTS = [
  "Tratamiento antibiótico con Amoxicilina 500mg por 7 días (completado satisfactoriamente)",
  "Terapia antihipertensiva con Enalapril 5mg/día (en curso, buena respuesta)",
  "Tratamiento antidiabético con Metformina 500mg 2x/día (en curso, glucemia en control)",
  "Ciclo de Ibuprofeno 400mg por lumbalgia aguda (5 días, con mejoría parcial)",
  "Tratamiento antiparasitario con Albendazol 400mg dosis única (completado)",
  "Fisioterapia por contractura muscular paravertebral (10 sesiones, mejoría significativa)",
  "Tratamiento con Omeprazol 20mg por gastritis crónica (21 días, asintomático actualmente)",
  "Suplemento vitamínico complejo B + Vitamina C por anemia leve (30 días)",
  "Tratamiento con Azitromicina 500mg por infección respiratoria alta (3 días, resuelto)",
  "Hidratación oral supervisada por deshidratación moderada (2 días, recuperado)",
];

// ── Reacciones alérgicas
const ALLERGY_REACTIONS = [
  "Urticaria generalizada y prurito intenso",
  "Erupción cutánea maculopapular en tronco",
  "Angioedema periorbital leve",
  "Broncoespasmo leve con sibilancias",
  "Rash eritematoso y prurito localizado",
  "Náuseas y malestar gastrointestinal",
];

// ─────────────────── SEED A — Entidades base ───────────────────
const seedA = async () => {
  console.log(colors.cyan("\n[SEED-A] Limpiando colecciones previas..."));
  await Promise.all([
    Health.deleteMany(),
    Sus.deleteMany(),
    Category.deleteMany(),
    Services.deleteMany(),
    User.deleteMany(),
    Doctor.deleteMany(),
    DoctorSchedule.deleteMany(),
    Patient.deleteMany(),
    HealthRecord.deleteMany(),
    Appointment.deleteMany(),
    Stock.deleteMany(),
    Prescription.deleteMany(),
  ]);

  // Limpiar índices simples que pueden quedar de versiones anteriores del schema
  const dropIdx = async (col, idx) => {
    try { await col.collection.dropIndex(idx); } catch (_) {}
  };
  await dropIdx(Patient, "email_1");
  await dropIdx(Patient, "susCode_1");

  console.log(colors.green("  ✓ Colecciones e índices huérfanos limpios"));

  // ── 1. Centros de salud
  const centerDocs = await Health.insertMany([
    { name: "Puerto Acosta", codigo: 200267, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Av. Principal S/N, Puerto Acosta"  },
    { name: "Cotapata",      codigo: 200860, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Calle Central S/N, Cotapata"        },
    { name: "Sallacucho",    codigo: 200268, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Plaza Principal S/N, Sallacucho"    },
    { name: "Iquipuni",      codigo: 200264, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Av. Central S/N, Iquipuni"           },
    { name: "Pasuja Belen",  codigo: 200266, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Calle Principal S/N, Pasuja Belén"  },
    { name: "Chiñaya",       codigo: 200261, departamento: "La Paz", municipio: "Puerto Acosta", nivel: 1, direccion: "Plaza Central S/N, Chiñaya"         },
  ]);
  console.log(colors.green(`  ✓ ${centerDocs.length} centros de salud`));

  // ── 2. Categorías (íconos reales del proyecto)
  await Category.insertMany([
    { name: "TELESALUD",           description: "Servicios de telemedicina y teleconsulta",         icon: "assistance.png"   },
    { name: "BONO JUANA AZURDUY",  description: "Programa de salud materno infantil Juana Azurduy", icon: "mother.png"       },
    { name: "MEDICINA GENERAL",    description: "Atención médica general y preventiva",             icon: "medical-team.png" },
    { name: "PAI",                 description: "Programa Ampliado de Inmunización",                icon: "vaccination.png"  },
    { name: "ODONTOLOGIA",         description: "Atención odontológica preventiva y curativa",      icon: "dentistry.png"    },
  ]);
  console.log(colors.green("  ✓ 5 categorías"));

  // ── 3. Servicios
  const svcDocs = await Services.insertMany([
    { name: "Nueva teleconsulta",           category: "TELESALUD"          },
    { name: "Teleconsulta y seguimiento",   category: "TELESALUD"          },
    { name: "Ecografía diagnóstica",        category: "TELESALUD"          },
    { name: "Medicina cardiovascular",      category: "TELESALUD"          },
    { name: "Primera consulta",             category: "BONO JUANA AZURDUY" },
    { name: "Control y seguimiento",        category: "BONO JUANA AZURDUY" },
    { name: "Control prenatal",             category: "BONO JUANA AZURDUY" },
    { name: "Seguimiento pediátrico",       category: "BONO JUANA AZURDUY" },
    { name: "Primera consulta",             category: "MEDICINA GENERAL"   },
    { name: "Control y seguimiento",        category: "MEDICINA GENERAL"   },
    { name: "Papanicolau",                  category: "MEDICINA GENERAL"   },
    { name: "Atención geriátrica integral", category: "MEDICINA GENERAL"   },
    { name: "Primera consulta",             category: "PAI"                },
    { name: "Control y seguimiento",        category: "PAI"                },
    { name: "Primera consulta",             category: "ODONTOLOGIA"        },
    { name: "Control y seguimiento",        category: "ODONTOLOGIA"        },
  ]);
  console.log(colors.green(`  ✓ ${svcDocs.length} servicios`));

  // ── 4. Admin global
  const adminSus = nextSus();
  await Sus.create({ name: "Administrador SIGMED", codigo: adminSus });
  await User.create({
    primerApellido: "Admin",
    segundoApellido: "SIGMED",
    nombres: "Sistema",
    email: "admin@sigmed.bo",
    password: "Admin123456",
    verified: true,
    admin: true,
    health: centerDocs[0]._id,
    susCode: adminSus,
  });
  console.log(colors.green("  ✓ Admin: admin@sigmed.bo / Admin123456"));

  // ── 5. Por centro: encargado + médicos + usuarios + pacientes
  const doctorsByCenter  = {};
  const patientsByCenter = {};

  for (const center of centerDocs) {
    console.log(colors.yellow(`\n  ▸ ${center.name}`));

    // Encargado (branchManager)
    const bmSus = nextSus();
    await Sus.create({ name: `Encargado ${center.name}`, codigo: bmSus });
    await User.create({
      primerApellido: pick(APELLIDOS),
      segundoApellido: pick(APELLIDOS),
      nombres: pick(NOMBRES_M),
      email: mkEmail(`encargado${center.codigo}`),
      password: "Manager123",
      verified: true,
      branchManager: true,
      health: center._id,
      susCode: bmSus,
    });

    // Farmacéutico (1 por centro)
    const pharmSus = nextSus();
    await Sus.create({ name: `Farmacéutico ${center.name}`, codigo: pharmSus });
    await User.create({
      primerApellido: pick(APELLIDOS),
      segundoApellido: pick(APELLIDOS),
      nombres: Math.random() > 0.5 ? pick(NOMBRES_F) : pick(NOMBRES_M),
      email: mkEmail(`farmaceutico${center.codigo}`),
      password: "Farmaceutico123",
      verified: true,
      pharmacist: true,
      health: center._id,
      susCode: pharmSus,
    });

    // Médicos (10 por centro, uno por especialidad)
    const centerDoctors = [];
    for (let d = 0; d < 10; d++) {
      const isFemale  = Math.random() > 0.45;
      const firstName = isFemale ? pick(NOMBRES_F) : pick(NOMBRES_M);
      const ap1       = pick(APELLIDOS);
      const ap2       = pick(APELLIDOS);
      const spec      = SPECIALTIES[d];
      const drSus     = nextSus();
      const drEmail   = mkEmail(`dr${ap1}`);
      const license   = `MP-${center.codigo}-${String(d + 1).padStart(3, "0")}`;

      await Sus.create({ name: `${firstName} ${ap1}`, codigo: drSus });

      const drUser = await User.create({
        primerApellido: ap1,
        segundoApellido: ap2,
        nombres: firstName,
        email: drEmail,
        password: "Doctor123",
        verified: true,
        doctor: true,
        health: center._id,
        susCode: drSus,
      });

      const doctor = await Doctor.create({
        name: `${firstName} ${ap1} ${ap2}`,
        specialty: spec,
        licenseNumber: license,
        contactInfo: {
          email: drEmail,
          phone: `7${ri(1000000, 9999999)}`,
          address: `${center.name}, La Paz, Bolivia`,
        },
        yearsOfExperience: ri(1, 22),
        health: center._id,
        active: true,
      });

      await User.findByIdAndUpdate(drUser._id, { doctorProfile: doctor._id });

      // Horario: lunes–viernes obligatorio + sábado opcional
      const workDays = pickN(["Lunes","Martes","Miércoles","Jueves","Viernes"], ri(3, 5));
      if (Math.random() > 0.6) workDays.push("Sábado");
      await DoctorSchedule.insertMany(
        workDays.map((day) => ({
          doctor: doctor._id,
          dayOfWeek: day,
          morning:   Math.random() > 0.2,
          afternoon: Math.random() > 0.45,
          active: true,
        }))
      );

      centerDoctors.push(doctor);
    }
    doctorsByCenter[center._id] = centerDoctors;

    // Usuarios regulares (39 por centro)
    const regularUsers = [];
    for (let u = 0; u < 39; u++) {
      const isFemale  = Math.random() > 0.5;
      const firstName = isFemale ? pick(NOMBRES_F) : pick(NOMBRES_M);
      const ap1       = pick(APELLIDOS);
      const uSus      = nextSus();

      await Sus.create({ name: `${firstName} ${ap1}`, codigo: uSus });
      const usr = await User.create({
        primerApellido: ap1,
        segundoApellido: pick(APELLIDOS),
        nombres: firstName,
        email: mkEmail(`usr${ap1}`),
        password: "User123456",
        verified: true,
        health: center._id,
        susCode: uSus,
      });
      regularUsers.push(usr);
    }

    // Pacientes (50 por centro: 20 vinculados a usuario, 30 sin cuenta)
    const centerPatients = [];
    for (let p = 0; p < 50; p++) {
      const isLinked  = p < 20;
      const isFemale  = Math.random() > 0.48;
      const gender    = isFemale ? "Femenino" : "Masculino";
      const firstName = isFemale ? pick(NOMBRES_F) : pick(NOMBRES_M);
      const ap1       = pick(APELLIDOS);
      const ap2       = pick(APELLIDOS);
      const pSus      = nextSus();

      await Sus.create({ name: `${firstName} ${ap1}`, codigo: pSus });

      const allergyVal = Math.random() > 0.65 ? pick(ALLERGIES_OPT) : null;

      const patient = await Patient.create({
        primerApellido: ap1,
        segundoApellido: ap2,
        nombres: firstName,
        dateOfBirth: rDate(new Date("1948-01-01"), new Date("2012-12-31")),
        gender,
        email: mkEmail(`pac${ap1}`),
        contactInfo: {
          phone: `7${ri(1000000, 9999999)}`,
          address: `${center.name}, La Paz, Bolivia`,
        },
        emergencyContact: {
          name: `${pick(NOMBRES_M)} ${pick(APELLIDOS)}`,
          phone: `6${ri(1000000, 9999999)}`,
          relationship: pick(RELATIONSHIPS),
        },
        medicalConditions: Math.random() > 0.55 ? [pick(CONDITIONS)] : [],
        allergies:         allergyVal ? [allergyVal] : [],
        healthCenter: center._id,
        susCode: pSus,
        user: isLinked ? regularUsers[p]._id : undefined,
      });
      centerPatients.push(patient);
    }

    patientsByCenter[center._id] = centerPatients;
    console.log(colors.green(`    ✓ 10 médicos · 39 usuarios · 50 pacientes`));
  }

  return { centerDocs, svcDocs, doctorsByCenter, patientsByCenter };
};

// ─────────────────── SEED B — Citas + Historiales ───────────────────
const seedB = async (centerDocs, svcDocs, doctorsByCenter, patientsByCenter) => {
  const now  = new Date();
  const from = new Date(now); from.setMonth(from.getMonth() - 4);
  const to   = new Date(now); to.setMonth(to.getMonth()   + 2);

  for (const center of centerDocs) {
    const doctors  = doctorsByCenter[center._id];
    const patients = patientsByCenter[center._id];

    console.log(colors.yellow(`\n  ▸ Citas + Historiales: ${center.name}`));

    const bmUser = await User.findOne({ health: center._id, branchManager: true });

    // ── Citas médicas: 100 por centro, solo días hábiles, sin slot repetido
    const usedSlots = new Set();
    const toInsert  = [];
    let   attempts  = 0;

    while (toInsert.length < 100 && attempts < 2000) {
      attempts++;
      const doctor  = pick(doctors);
      const patient = pick(patients);

      const date = rWeekday(from, to);
      date.setHours(0, 0, 0, 0);
      const time = pick(TIMES);
      const slot = `${doctor._id}-${date.toISOString().split("T")[0]}-${time}`;
      if (usedSlots.has(slot)) continue;
      usedSlots.add(slot);

      toInsert.push({
        doctor:   doctor._id,
        patient:  patient._id,
        user:     patient.user ?? null,
        health:   center._id,
        services: pickN(svcDocs, ri(1, 3)).map((s) => s._id),
        date,
        time,
        state: aptState(date),
        notes: "",
      });
    }

    const insertedApts = await Appointment.insertMany(toInsert);

    for (const apt of insertedApts) {
      await Patient.findByIdAndUpdate(apt.patient, { $push: { appointments: apt._id } });
    }
    console.log(colors.green(`    ✓ ${insertedApts.length} citas (solo lun-vie, estado por fecha)`));

    // ── Historiales clínicos: 1 por paciente con datos ricos
    let hrCount = 0;
    for (const patient of patients) {
      const now2 = new Date();

      // Diagnósticos: 1-4, siempre al menos 1
      const diagnoses = Array.from({ length: ri(1, 4) }, () => {
        const dx = pick(DIAGNOSES);
        return {
          code:        dx.code,
          description: dx.description,
          notes:       dx.notes,
          date:        rDate(from, now2),
          createdBy:   bmUser?._id ?? null,
        };
      });

      // Observaciones clínicas: 3-6
      const observations = Array.from({ length: ri(3, 6) }, () => ({
        note:      pick(OBSERVATIONS),
        date:      rDate(from, now2),
        createdBy: bmUser?._id ?? null,
      }));

      // Signos vitales: 2-4 registros (uno por consulta)
      const vitalSigns = Array.from({ length: ri(2, 4) }, () => ({
        date:             rDate(from, now2),
        systolicBP:       ri(100, 148),
        diastolicBP:      ri(60, 96),
        heartRate:        ri(56, 108),
        temperature:      parseFloat((36.0 + Math.random() * 2.4).toFixed(1)),
        oxygenSaturation: ri(87, 99),
        weight:           parseFloat((42 + Math.random() * 58).toFixed(1)),
        notes:            Math.random() > 0.6 ? "Paciente en reposo al momento de la toma." : "",
        createdBy:        bmUser?._id ?? null,
      }));

      // Tratamientos previos: 50% de los pacientes tienen 1-2
      const previousTreatments = Math.random() > 0.5
        ? Array.from({ length: ri(1, 2) }, () => {
            const trtFrom = rDate(new Date("2023-01-01"), from);
            const trtTo   = new Date(trtFrom);
            trtTo.setDate(trtTo.getDate() + ri(7, 60));
            return { treatment: pick(PREV_TREATMENTS), from: trtFrom, to: trtTo, createdBy: bmUser?._id ?? null };
          })
        : [];

      // Historial de alergias: si el paciente tiene alergia registrada
      const allergyHistory = patient.allergies?.length > 0 && patient.allergies[0] !== "Sin alergias conocidas"
        ? [{
            substance:  patient.allergies[0],
            reaction:   pick(ALLERGY_REACTIONS),
            date:       rDate(new Date("2020-01-01"), from),
            createdBy:  bmUser?._id ?? null,
          }]
        : [];

      const record = await HealthRecord.create({
        patient: patient._id,
        state: pick(["activo","activo","activo","en tratamiento","cerrado"]),
        diagnoses,
        observations,
        vitalSigns,
        previousTreatments,
        allergyHistory,
      });

      await Patient.findByIdAndUpdate(patient._id, { medicalHistory: record._id });
      hrCount++;
    }
    console.log(colors.green(`    ✓ ${hrCount} historiales clínicos (con diagnósticos, vitales, tratamientos)`));
  }
};

// ─────────────────── SEED C — Stock + Recetas médicas ───────────────────
const seedC = async (centerDocs, patientsByCenter) => {
  const now  = new Date();
  const from = new Date(now); from.setMonth(from.getMonth() - 3);

  for (const center of centerDocs) {
    const patients    = patientsByCenter[center._id];
    const bmUser      = await User.findOne({ health: center._id, branchManager: true });
    const pharmUser   = await User.findOne({ health: center._id, pharmacist:    true });
    const doctorUsers = await User.find({ health: center._id, doctor: true }).lean();

    // ── Stock: 18 medicamentos por centro
    const stockDocs = await Stock.insertMany(
      STOCK_CATALOG.map((med) => ({
        ...med,
        // 2 de cada 18 quedan con stock bajo (para probar alertas)
        availableQuantity: Math.random() < 0.11 ? ri(1, med.minimumQuantity - 1) : ri(60, 280),
        health: center._id,
        active: true,
      }))
    );

    // ── Recetas: 25 por centro
    let rxCount = 0;
    for (let i = 0; i < 25; i++) {
      const patient  = pick(patients);
      const rxDate   = rDate(from, now);
      const status = Math.random() < 0.5 ? "Pendiente" : "Despachada";

      // Prescriptor: 70% encargado, 30% médico aleatorio
      const prescriber = Math.random() < 0.7 || doctorUsers.length === 0
        ? bmUser
        : pick(doctorUsers);

      const numItems   = ri(1, 3);
      const pickedStk  = pickN(stockDocs, numItems);

      const items = pickedStk.map((stk) => {
        const qty          = ri(5, 30);
        const isDispensed  = status === "Despachada";
        const qtyDispensed = isDispensed ? qty : 0;
        const hasDispenser = isDispensed && pharmUser;

        return {
          stock:              stk._id,
          medicationName:     stk.name,
          dose:               pick(RX_DOSES),
          frequency:          pick(RX_FREQUENCIES),
          duration:           pick(RX_DURATIONS),
          quantityToDispense: qty,
          quantityDispensed:  qtyDispensed,
          dispensed:          isDispensed,
          dispensedBy:        hasDispenser ? pharmUser._id : null,
          dispensedAt:        hasDispenser ? rDate(rxDate, now) : null,
        };
      });

      await Prescription.create({
        code:          nextRxCode(rxDate),
        patient:       patient._id,
        prescribedBy:  prescriber._id,
        doctor:        null,
        appointment:   null,
        date:          rxDate,
        health:        center._id,
        items,
        notes:         pick(RX_NOTES),
        status,
      });
      rxCount++;
    }

    console.log(colors.green(
      `    ✓ ${stockDocs.length} medicamentos en stock · ${rxCount} recetas (Pendiente/Despachada)`
    ));
  }
};

// ─────────────────── LIMPIEZA COMPLETA ───────────────────
const clearAll = async () => {
  console.log(colors.red("\n[CLEAR] Eliminando todos los datos..."));
  await Promise.all([
    Health.deleteMany(),
    Sus.deleteMany(),
    Category.deleteMany(),
    Services.deleteMany(),
    User.deleteMany(),
    Doctor.deleteMany(),
    DoctorSchedule.deleteMany(),
    Patient.deleteMany(),
    HealthRecord.deleteMany(),
    Appointment.deleteMany(),
    Stock.deleteMany(),
    Prescription.deleteMany(),
  ]);
  console.log(colors.red.bold("✓ Todas las colecciones vaciadas."));
  process.exit();
};

// ─────────────────── ENTRADA ───────────────────
const arg = process.argv[2];

if (arg === "--import") {
  try {
    console.log(colors.yellow.bold("\n══════════════════════════════════════════════"));
    console.log(colors.yellow.bold("   SEED COMPLETO — SIGMED-PA / G.A.M.P.A.    "));
    console.log(colors.yellow.bold("══════════════════════════════════════════════"));

    const { centerDocs, svcDocs, doctorsByCenter, patientsByCenter } = await seedA();
    await seedB(centerDocs, svcDocs, doctorsByCenter, patientsByCenter);
    console.log(colors.cyan("\n[SEED-C] Stock + Recetas médicas..."));
    await seedC(centerDocs, patientsByCenter);

    console.log(colors.green.bold("\n══════════════════════════════════════════════"));
    console.log(colors.green.bold("   ✓ Seed finalizado con éxito                "));
    console.log(colors.green.bold("   Admin:       admin@sigmed.bo / Admin123456  "));
    console.log(colors.green.bold("   Farmacéutico: farmaceutico{codigo}@sigmed.bo / Farmaceutico123"));
    console.log(colors.green.bold("══════════════════════════════════════════════"));
    process.exit();
  } catch (err) {
    console.error(colors.red.bold("\n✗ Error:"), err.message);
    console.error(err);
    process.exit(1);
  }
} else if (arg === "--clear") {
  await clearAll();
} else {
  console.log("Uso: node data/seed-full.js --import | --clear");
  process.exit(1);
}
