import {
  getLikesByPostId,
  createLike,
  deleteLike,
} from "../controllers/likes.js";
import { Like } from "../models/like.js";
import { redisClient } from "../config/redis.js";

// Mock dependencies
jest.mock("../models/like.js");
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

describe("Likes Controller", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      params: {},
      user: { id: 1 },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getLikesByPostId", () => {
    it("should get likes from database if not in cache", async () => {
      // Arrange
      req.params.postId = "123";
      redisClient.get.mockResolvedValue(null);

      const likes = [
        { id: 1, user_id: 1, post_id: 123, created_at: new Date() },
        { id: 2, user_id: 2, post_id: 123, created_at: new Date() },
      ];

      Like.findAll.mockResolvedValue(likes);

      // Act
      await getLikesByPostId(req, res);

      // Assert
      expect(Like.findAll).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: likes,
        })
      );
    });
  });

  describe("createLike", () => {
    it("should create a like successfully", async () => {
      // Arrange
      req.params.postId = "123";
      req.user.id = 1;

      Like.findOne.mockResolvedValue(null);
      Like.create.mockResolvedValue({
        id: 1,
        post_id: 123,
        user_id: 1,
        created_at: new Date(),
      });

      // Act
      await createLike(req, res);

      // Assert
      expect(Like.create).toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Post liked successfully",
        })
      );
    });

    it("should return 409 if like already exists", async () => {
      // Arrange
      req.params.postId = "123";
      req.user.id = 1;

      Like.findOne.mockResolvedValue({
        id: 1,
        post_id: 123,
        user_id: 1,
      });

      // Act
      await createLike(req, res);

      // Assert
      expect(Like.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User has already liked this post",
        })
      );
    });
  });
});
