import mongoose from "mongoose";

const categorySchema = mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, trim: true, default: "" },
  icon: { type: String, trim: true, default: "assistance.png" },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;