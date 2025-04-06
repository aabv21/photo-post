import { Sequelize } from "sequelize";
import path from "path";
import fs from "fs";

// Determine database path
const dbPath =
  process.env.SQLITE_PATH || path.join(process.cwd(), "data", "auth.db");

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: false,
  },
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log(
      "SQLite database connection has been established successfully."
    );
  } catch (error) {
    console.error("Unable to connect to the SQLite database:", error);
  }
};

// Initialize connection
testConnection();

export default sequelize;
