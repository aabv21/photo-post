import express from "express";
import * as usersController from "../controllers/users.js";
import { authenticateJWT } from "../middlewares/auth.js";

const router = express.Router();

// Define routes
router.get("/me", authenticateJWT, usersController.getCurrentUser);
router.put("/me", authenticateJWT, usersController.updateUser);
router.get("/search", usersController.searchUsers);
router.get("/:id", usersController.getUserById);

export default router;
