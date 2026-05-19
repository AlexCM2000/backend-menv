import mongoose from "mongoose";

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const doctorScheduleSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  dayOfWeek: {
    type: String,
    enum: DAYS,
    required: true,
  },
  morning: { type: Boolean, default: false },
  afternoon: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });

doctorScheduleSchema.index({ doctor: 1, dayOfWeek: 1 }, { unique: true });

const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);
export default DoctorSchedule;
