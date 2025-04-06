import DataTypes from "sequelize";
import sequelize from "../config/sqlite.js";

// User Profile Model
const User = sequelize.define(
  "User",
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
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Initialize models
async function initModels() {
  try {
    await sequelize.sync();
    console.log("User models synchronized successfully");
  } catch (error) {
    console.error("Error synchronizing user models:", error);
  }
}

initModels();

export default User;
