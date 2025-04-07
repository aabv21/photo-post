import Joi from "joi";

/**
 * Validate user update input
 * @param {Object} data - The user data to validate
 * @returns {Object} - Validation result
 */
export const validateUserUpdate = (data) => {
  const schema = Joi.object({
    full_name: Joi.string().max(100).allow("", null),
    bio: Joi.string().max(500).allow("", null),
  });

  return schema.validate(data);
};

/**
 * Validate search query
 * @param {Object} data - The search parameters
 * @returns {Object} - Validation result
 */
export const validateSearchQuery = (data) => {
  const schema = Joi.object({
    query: Joi.string().min(3).required(),
  });

  return schema.validate(data);
};

/**
 * Validate pagination parameters
 * @param {Object} data - The pagination parameters
 * @returns {Object} - Validation result
 */
export const validatePagination = (data) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  });

  return schema.validate(data);
};
