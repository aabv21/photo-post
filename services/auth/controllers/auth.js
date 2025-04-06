import { Auth } from "../models/auth.js";
import { Op } from "sequelize";
import { validateRegistration, validateLogin } from "../utils/validators.js";
import { hashPassword, comparePassword } from "../utils/passwordUtils.js";
import { generateToken, invalidateToken } from "../utils/tokenUtils.js";
import { publishMessage } from "../config/kafka.js";
import { logger } from "../middlewares/logger.js";

/**
 * Register a new user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The registered user object
 */
export const register = async (req, res) => {
  try {
    // Validate request body
    const { error } = validateRegistration(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await Auth.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = await Auth.create({
      username,
      email,
      password: hashedPassword,
    });

    // Generate JWT token
    const { token } = await generateToken(newUser);

    // Publish user creation event to Kafka
    try {
      await publishMessage("user-events", {
        event: "user-created",
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          created_at: newUser.created_at,
        },
      });
      logger.info(`Published user-created event for user ${newUser.id}`);
    } catch (kafkaError) {
      logger.error(
        `Failed to publish user-created event: ${kafkaError.message}`
      );
      // Continue with the response even if Kafka fails
    }

    // Return user info and token
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        token,
      },
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Login user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The logged in user object
 */
export const login = async (req, res) => {
  try {
    // Validate request body
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    const user = await Auth.findOne({
      where: {
        [Op.or]: [
          { username },
          { email: username }, // Allow login with email too
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const { token } = await generateToken(user);

    // Return user info and token
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        token,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Logout user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The logout response object
 */
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No token provided",
      });
    }

    // Invalidate token
    const success = await invalidateToken(token);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Token not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get current user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The current user object
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User is already authenticated by passport middleware
    const user = await Auth.findByPk(req.user.id, {
      attributes: ["id", "username", "email", "created_at", "updated_at"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
