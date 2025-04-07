import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../middlewares/logger.js";

/**
 * Delete image file from filesystem
 * @param {string} imageUrl - URL of the image to delete
 * @returns {boolean} - Success status
 */
export const deleteImageFile = (imageUrl) => {
  try {
    // Extract filename from URL
    const urlParts = imageUrl.split("/");
    const filename = urlParts[urlParts.length - 1];

    // Construct file path
    const filePath = path.join(process.cwd(), "uploads", filename);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      // Delete file
      fs.unlinkSync(filePath);
      logger.info(`Deleted image file: ${filePath}`);
      return true;
    }

    logger.warn(`Image file not found: ${filePath}`);
    return false;
  } catch (error) {
    logger.error(`Error deleting image file: ${error.message}`, {
      stack: error.stack,
    });
    return false;
  }
};

/**
 * Ensure uploads directory exists
 */
export const ensureUploadsDirectory = () => {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

/**
 * Generate unique filename for uploaded file
 * @param {string} originalFilename - Original filename
 * @returns {string} - Unique filename
 */
export const generateUniqueFilename = (originalFilename) => {
  const fileExt = path.extname(originalFilename);
  return `${uuidv4()}${fileExt}`;
};
