import express from "express";
import {
  register,
  login,
  logout,
  getCurrentAuth,
} from "../controllers/auth.js";
import { authenticateJWT } from "../middlewares/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.post("/logout", [authenticateJWT], logout);
router.get("/me", [authenticateJWT], getCurrentAuth);

export default router;
