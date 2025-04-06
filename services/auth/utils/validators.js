import Joi from "joi";

// Validate user registration data
export const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required().messages({
      "string.base": "Username must be a string",
      "string.alphanum": "Username must only contain alphanumeric characters",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username cannot be longer than 30 characters",
      "any.required": "Username is required",
    }),
    email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Email must be a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.base": "Password must be a string",
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
  });

  return schema.validate(data);
};

// Validate user login data
export const validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string().required().messages({
      "string.base": "Username or email must be a string",
      "any.required": "Username or email is required",
    }),
    password: Joi.string().required().messages({
      "string.base": "Password must be a string",
      "any.required": "Password is required",
    }),
  });

  return schema.validate(data);
};
