import DataTypes from "sequelize";
import sequelize from "../config/sqlite.js";

// Auth Model
const Auth = sequelize.define(
  "Auth",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "auths",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Initialize models
async function initModels() {
  try {
    await sequelize.sync();
    console.log("Auth models synchronized successfully");
  } catch (error) {
    console.error("Error synchronizing auth models:", error);
  }
}

initModels();

export { Auth };
