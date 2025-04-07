import express from "express";
import {
  getPostsByUserId,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getAllPosts,
  getImage,
} from "../controllers/posts.js";
import { authenticateJWT } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.get("/", getAllPosts);
router.get("/:id", getPostById);
router.get("/users/:userId", getPostsByUserId);

// Protected routes
router.post("/", authenticateJWT, createPost);
router.put("/:id", authenticateJWT, updatePost);
router.delete("/:id", authenticateJWT, deletePost);

// Route for serving images with optional transformations
router.get("/image/:filename", authenticateJWT, getImage);

export default router;
