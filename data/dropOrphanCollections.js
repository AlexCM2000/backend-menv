import dotenv from "dotenv";
import mongoose from "mongoose";
import colors from "colors";
import { db } from "../config/db.js";

dotenv.config();

const ORPHAN_COLLECTIONS = ["diagnoses", "medications", "observations", "previoustreatments"];

await db();

try {
  const existingCollections = (await mongoose.connection.db.listCollections().toArray()).map(
    (c) => c.name
  );

  for (const name of ORPHAN_COLLECTIONS) {
    if (existingCollections.includes(name)) {
      await mongoose.connection.db.dropCollection(name);
      console.log(colors.green(`✓ Colección eliminada: ${name}`));
    } else {
      console.log(colors.yellow(`— No existe: ${name}`));
    }
  }

  console.log(colors.cyan.bold("\nLimpieza completada."));
} catch (error) {
  console.error(colors.red("Error durante la limpieza:"), error.message);
} finally {
  await mongoose.connection.close();
  process.exit(0);
}
