import { getUserById, updateUser, searchUsers } from "../controllers/users.js";
import User from "../models/user.js";
import { redisClient } from "../config/redis.js";
import { Op } from "sequelize";

// Mock dependencies
jest.mock("../models/user.js");
jest.mock("../config/redis.js", () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock("../middlewares/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock("../utils/validators.js", () => ({
  validateUserUpdate: jest.fn().mockReturnValue({ error: null }),
}));

describe("Users Controller", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      user: { id: 1 },
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    it("should get user from database if not in cache", async () => {
      // Arrange
      req.params.id = "1";
      redisClient.get.mockResolvedValue(null);

      const user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        full_name: "Test User",
        created_at: new Date(),
        updated_at: new Date(),
      };

      User.findByPk.mockResolvedValue(user);

      // Act
      await getUserById(req, res);

      // Assert
      expect(User.findByPk).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: user,
        })
      );
    });

    it("should return 404 if user not found", async () => {
      // Arrange
      req.params.id = "999";
      redisClient.get.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(null);

      // Act
      await getUserById(req, res);

      // Assert
      expect(User.findByPk).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found",
        })
      );
    });
  });

  describe("searchUsers", () => {
    it("should search users successfully", async () => {
      // Arrange
      req.query = { query: "test" };

      const users = [
        { id: 1, username: "testuser1", full_name: "Test User 1" },
        { id: 2, username: "testuser2", full_name: "Test User 2" },
      ];

      User.findAll.mockResolvedValue(users);

      // Act
      await searchUsers(req, res);

      // Assert
      expect(User.findAll).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: users,
        })
      );
    });
  });
});
