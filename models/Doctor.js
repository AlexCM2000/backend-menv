import mongoose from "mongoose";

const doctorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    specialty: {
        type: String,
        required: true,
        trim: true
    },
    licenseNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    contactInfo: {
        email: {
            type: String,
            sparse: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            trim: true
        }
    },
    yearsOfExperience: {
        type: Number,
        default: 0,
        min: 0
    },
    health: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Health",
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Doctor = mongoose.model("Doctor", doctorSchema);
export default Doctor;
