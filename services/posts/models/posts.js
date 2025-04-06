import DataTypes from "sequelize";
import sequelize from "../config/sqlite.js";

// Post Model
const Post = sequelize.define(
  "Post",
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "posts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Initialize models
async function initModels() {
  try {
    await sequelize.sync();
    console.log("Post models synchronized successfully");
  } catch (error) {
    console.error("Error synchronizing post models:", error);
  }
}

initModels();

export default Post;
