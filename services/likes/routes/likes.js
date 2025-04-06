import express from "express";
import {
  getLikesByPostId,
  createLike,
  deleteLike,
  getLikeCountByPostId,
} from "../controllers/likes.js";
import { authenticateJWT } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.get("/posts/:postId/count", getLikeCountByPostId);
router.get("/posts/:postId", getLikesByPostId);

// Protected routes
router.post("/posts/:postId", authenticateJWT, createLike);
router.delete("/posts/:postId", authenticateJWT, deleteLike);

export default router;
