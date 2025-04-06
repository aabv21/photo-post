import { getPostById, createPost, getAllPosts } from "../controllers/posts.js";
import { Post } from "../models/post.js";
import { redisClient } from "../config/redis.js";
import axios from "axios";

// Mock dependencies
jest.mock("../models/post.js");
jest.mock("axios");
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

describe("Posts Controller", () => {
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

  describe("getPostById", () => {
    it("should get post from database if not in cache", async () => {
      // Arrange
      req.params.id = "1";
      redisClient.get.mockResolvedValue(null);

      const post = {
        id: 1,
        user_id: 1,
        caption: "Test post",
        image_url: "http://example.com/image.jpg",
        created_at: new Date(),
        updated_at: new Date(),
      };

      Post.findByPk.mockResolvedValue(post);
      axios.get.mockResolvedValue({
        data: { success: true, data: { count: 5 } },
      });

      // Act
      await getPostById(req, res);

      // Assert
      expect(Post.findByPk).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 1,
            like_count: 5,
          }),
        })
      );
    });
  });

  describe("createPost", () => {
    it("should create a post successfully", async () => {
      // Arrange
      req.user.id = 1;
      req.body = {
        caption: "New test post",
        image_url: "http://example.com/new-image.jpg",
      };

      Post.create.mockResolvedValue({
        id: 1,
        user_id: 1,
        caption: "New test post",
        image_url: "http://example.com/new-image.jpg",
        created_at: new Date(),
      });

      // Act
      await createPost(req, res);

      // Assert
      expect(Post.create).toHaveBeenCalledWith({
        user_id: 1,
        caption: "New test post",
        image_url: "http://example.com/new-image.jpg",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Post created successfully",
        })
      );
    });
  });

  describe("getAllPosts", () => {
    it("should get all posts with pagination", async () => {
      // Arrange
      req.query = { page: "1", limit: "10" };
      redisClient.get.mockResolvedValue(null);

      const posts = [
        { id: 1, user_id: 1, caption: "Post 1", created_at: new Date() },
        { id: 2, user_id: 2, caption: "Post 2", created_at: new Date() },
      ];

      Post.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: posts,
      });

      // Act
      await getAllPosts(req, res);

      // Assert
      expect(Post.findAndCountAll).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: posts,
          pagination: expect.objectContaining({
            total: 2,
            page: 1,
          }),
        })
      );
    });
  });
});
