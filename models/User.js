import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { uniqueId } from "../utils/index.js";

const userSchema = mongoose.Schema(
  {
    primerApellido: {
      type: String,
      required: true,
      trim: true,
    },
    segundoApellido: {
      type: String,
      trim: true,
      default: "",
    },
    nombres: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    token: {
      type: String,
      default: () => uniqueId(),
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    admin: {
      type: Boolean,
      default: false,
    },
    branchManager: {
      type: Boolean,
      default: false,
    },
    doctor: {
      type: Boolean,
      default: false,
    },
    doctorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    health: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Health",
      required: true,
    },
    susCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.checkPassword = async function (formPassword) {
  return await bcrypt.compare(formPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
