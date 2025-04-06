import express from "express";
import {
  register,
  login,
  logout,
  getCurrentAuth,
} from "../controllers/auth.js";
import { authenticateJWT, validateToken } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.post("/logout", [authenticateJWT, validateToken], logout);
router.get("/me", [authenticateJWT, validateToken], getCurrentAuth);

export default router;
