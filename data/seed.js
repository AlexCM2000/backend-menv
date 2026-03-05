import dotenv from "dotenv";
import { db } from "../config/db.js";
import Services from "../models/Services.js";
import { services } from "./beautyServices.js";
import colors from "colors";

dotenv.config();

await db();

const seedDB = async () => {
  try {
    await Services.insertMany(services);
    console.log(colors.green.bold("se agrgo correctamente"));
    process.exit();
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

const clearDB = async () => {
  try {
    await Services.deleteMany();
    console.log(colors.red.bold("se elimino los datos"));
    process.exit();
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

if (process.argv[2] === "--import") {
  seedDB();
} else {
  clearDB();
}
