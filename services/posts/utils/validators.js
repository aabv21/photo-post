import Joi from "joi";

/**
 * Validates post creation input
 * @param {Object} data - The post data to validate
 * @returns {Object} - Validation result
 */
export const validatePostCreation = (data) => {
  const schema = Joi.object({
    description: Joi.string().allow("", null).max(2000),
  });

  return schema.validate(data);
};

/**
 * Validates post update input
 * @param {Object} data - The post data to validate
 * @returns {Object} - Validation result
 */
export const validatePostUpdate = (data) => {
  const schema = Joi.object({
    description: Joi.string().allow("", null).max(2000),
  });

  return schema.validate(data);
};

/**
 * Validates image upload parameters
 * @param {Object} file - The uploaded file
 * @returns {Object} - Validation result with error message if invalid
 */
export const validateImageUpload = (file) => {
  if (!file) {
    return { error: { message: "No image file provided" } };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { error: { message: "Image file too large (max 5MB)" } };
  }

  // Check file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      error: {
        message: "Invalid file type. Only JPEG, PNG, GIF and WebP are allowed",
      },
    };
  }

  return { value: file };
};

/**
 * Validates image transformation parameters
 * @param {Object} data - The transformation parameters
 * @returns {Object} - Validation result
 */
export const validateImageTransformation = (data) => {
  const schema = Joi.object({
    width: Joi.number().integer().min(1).max(5000),
    height: Joi.number().integer().min(1).max(5000),
    format: Joi.string().valid("jpeg", "png", "webp", "avif"),
    quality: Joi.number().integer().min(1).max(100).default(80),
    fit: Joi.string()
      .valid("cover", "contain", "fill", "inside", "outside")
      .default("cover"),
  });

  return schema.validate(data);
};

/**
 * Validates pagination parameters
 * @param {Object} params - The pagination parameters
 * @returns {Object} - Validation result with default values
 */
export const validatePagination = (params) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  });

  return schema.validate(params);
};
