import DataTypes from "sequelize";
import sequelize from "../config/sqlite.js";

// Post Like Model
const Like = sequelize.define(
  "Like",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "likes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "post_id"],
      },
    ],
  }
);

// Initialize models
async function initModels() {
  try {
    await sequelize.sync();
    console.log("Like models synchronized successfully");
  } catch (error) {
    console.error("Error synchronizing like models:", error);
  }
}

initModels();

export default Like;
