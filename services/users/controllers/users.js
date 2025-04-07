import User from "../models/user.js";
import { Op } from "sequelize";
import { logger } from "../middlewares/logger.js";
import {
  validateUserUpdate,
  validateSearchQuery,
  validatePagination,
} from "../utils/validators.js";
import { redisClient } from "../config/redis.js";

// Cache TTL in seconds
const CACHE_TTL = 60 * 5; // 5 minutes

/**
 * Get user by ID
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The user object
 */
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const cacheKey = `user:${userId}`;

    // Try to get from cache first
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedUser),
        fromCache: true,
      });
    }

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "email",
        "full_name",
        "created_at",
        "updated_at",
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(user), {
      EX: CACHE_TTL,
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The current user object
 */
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "email",
        "full_name",
        "created_at",
        "updated_at",
      ],
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

/**
 * Update user profile
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The updated user object
 */
export const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate request body
    const { error, value } = validateUserUpdate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { full_name, bio } = value;

    // Find user
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (bio !== undefined) updateData.bio = bio;

    await user.update(updateData);

    // Invalidate cache
    await redisClient.del(`user:${userId}`);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    logger.error(`Update user error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create user from Kafka event (internal use)
 * @param {Object} userData - The user data object
 * @returns {Object} - The created user object
 */
export const createUserFromEvent = async (userData) => {
  try {
    logger.info(`Creating user from event: ${userData.id}`);

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { id: userData.id },
    });

    if (existingUser) {
      logger.warn(`User ${userData.id} already exists, skipping creation`);
      return existingUser;
    }

    // Create user
    const newUser = await User.create({
      id: userData.id,
      username: userData.username,
      email: userData.email,
      full_name: userData.full_name || userData.username || "",
    });

    logger.info(`User created successfully from event: ${newUser.id}`);
    return newUser;
  } catch (error) {
    logger.error(`Error creating user from event: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Search users
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The users object
 */
export const searchUsers = async (req, res) => {
  try {
    // Validate search query
    const { error, value } = validateSearchQuery(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { query } = value;

    // Validate pagination
    const paginationValidation = validatePagination(req.query);
    if (paginationValidation.error) {
      return res.status(400).json({
        success: false,
        message: paginationValidation.error.details[0].message,
      });
    }

    const { page, limit } = paginationValidation.value;
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${query}%` } },
          { full_name: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id", "username", "full_name"],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Search users error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
