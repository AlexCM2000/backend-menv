import mongoose from "mongoose";
import colors from "colors";

export const db = async () => {
  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    const url = `${db.connection.host}:${db.connection.port}`;
    console.log(
      colors.cyan.bgGreen("MongoDB se conecto correctamente:"),
      colors.bgWhite.bgBlue(url)
    );
  } catch (error) {
    console.log(`error:${error.message}`);
    process.exit(1);
  }
};
