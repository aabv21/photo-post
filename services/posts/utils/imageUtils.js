import path from "path";
import fs from "fs";
import sharp from "sharp";

/**
 * Get the full path to an image file
 * @param {string} filename - The filename of the image
 * @returns {string} - The full path to the image
 */
export const getImagePath = (filename) => {
  return path.join(process.cwd(), "uploads", filename);
};

/**
 * Check if an image file exists
 * @param {string} imagePath - The path to the image file
 * @returns {boolean} - Whether the image exists
 */
export const imageExists = (imagePath) => {
  return fs.existsSync(imagePath);
};

/**
 * Get MIME type based on file extension
 * @param {string} filename - The filename
 * @returns {string} - The MIME type
 */
export const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
  };

  return mimeTypes[ext] || "application/octet-stream";
};

/**
 * Apply transformations to an image
 * @param {string} imagePath - The path to the image
 * @param {Object} options - Transformation options
 * @returns {Promise<Object>} - Sharp transform object
 */
export const transformImage = async (imagePath, options) => {
  const { width, height, format, quality, fit } = options;

  // Create a Sharp instance with the image
  let transform = sharp(imagePath);

  // Get image metadata
  const metadata = await transform.metadata();

  // Apply resize if needed
  if (width || height) {
    transform = transform.resize({
      width: width || null,
      height: height || null,
      fit: fit || "cover",
      withoutEnlargement: true,
    });
  }

  // Apply format conversion if needed
  if (format) {
    const formatOptions = {};

    if (format === "jpeg" || format === "webp") {
      formatOptions.quality = parseInt(quality || 80);
    } else if (format === "png") {
      formatOptions.compressionLevel = Math.floor(parseInt(quality || 80) / 10);
    }

    transform = transform.toFormat(format, formatOptions);
  }

  return transform;
};
