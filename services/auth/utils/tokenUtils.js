import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis.js";
import { logger } from "../middlewares/logger.js";

// Token expiration time (in seconds)
const TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {Object} - Token object
 */
export const generateToken = async (user) => {
  try {
    // Create token payload
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    // Generate JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET || "jwt-secret", {
      expiresIn: TOKEN_EXPIRY,
    });

    // Store token in Redis with expiry
    const tokenKey = `auth:token:${token}`;
    await redisClient.set(tokenKey, JSON.stringify(payload), {
      EX: TOKEN_EXPIRY,
    });

    // Store user's active tokens for tracking
    const userTokensKey = `auth:user:${user.id}:tokens`;
    await redisClient.sAdd(userTokensKey, token);

    return { token, expiresIn: TOKEN_EXPIRY };
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    throw error;
  }
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} - Decoded token payload
 */
export const verifyToken = async (token) => {
  try {
    // Verify JWT signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "jwt-secret");

    // Check if token exists in Redis
    const tokenKey = `auth:token:${token}`;
    const tokenExists = await redisClient.exists(tokenKey);

    if (!tokenExists) {
      throw new Error("Token not found or invalidated");
    }

    return decoded;
  } catch (error) {
    logger.error(`Error verifying token: ${error.message}`);
    throw error;
  }
};

/**
 * Invalidate token
 * @param {String} token - JWT token
 * @returns {Boolean} - Success status
 */
export const invalidateToken = async (token) => {
  try {
    // Verify token first to get user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "jwt-secret");

    // Delete token from Redis
    const tokenKey = `auth:token:${token}`;
    const deleted = await redisClient.del(tokenKey);

    if (deleted) {
      // Remove from user's active tokens set
      const userTokensKey = `auth:user:${decoded.id}:tokens`;
      await redisClient.sRem(userTokensKey, token);
    }

    return deleted > 0;
  } catch (error) {
    logger.error(`Error invalidating token: ${error.message}`);
    return false;
  }
};

/**
 * Invalidate all tokens for a user
 * @param {Number} userId - User ID
 * @returns {Boolean} - Success status
 */
export const invalidateAllUserTokens = async (userId) => {
  try {
    // Get all tokens for user
    const userTokensKey = `auth:user:${userId}:tokens`;
    const tokens = await redisClient.sMembers(userTokensKey);

    // Delete each token
    for (const token of tokens) {
      const tokenKey = `auth:token:${token}`;
      await redisClient.del(tokenKey);
    }

    // Clear the set
    await redisClient.del(userTokensKey);

    return true;
  } catch (error) {
    logger.error(`Error invalidating all user tokens: ${error.message}`);
    return false;
  }
};
