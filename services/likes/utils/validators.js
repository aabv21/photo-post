import Joi from "joi";

/**
 * Validate like creation input
 * @param {Object} data - The like data to validate
 * @returns {Object} - Validation result
 */
export const validateLikeCreation = (data) => {
  const schema = Joi.object({
    postId: Joi.number().integer().positive().required(),
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
