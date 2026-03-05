import mongoose from "mongoose";

const healthSchema = mongoose.Schema({
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
            required: false,
            unique: true,
            trim: true
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
        default: 0
    },
    health:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Health",
        required: true
    },
}, { timestamps: true });

const Doctor = mongoose.model("Doctor", healthSchema);
export default Doctor;
