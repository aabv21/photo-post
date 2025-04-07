import express from "express";
import {
  getPostsByUserId,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getImage,
} from "../controllers/posts.js";
import { authenticateJWT } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.get("/:id", authenticateJWT, getPostById);
router.get("/", authenticateJWT, getPostsByUserId);

// Protected routes
router.post("/", authenticateJWT, createPost);
router.put("/:id", authenticateJWT, updatePost);
router.delete("/:id", authenticateJWT, deletePost);

// Route for serving images with optional transformations
router.get("/image/:filename", authenticateJWT, getImage);

export default router;
