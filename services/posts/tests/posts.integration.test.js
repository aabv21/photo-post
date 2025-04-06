import request from "supertest";
import app from "../index.js";
import { Post } from "../models/post.js";
import { redisClient } from "../config/redis.js";
import jwt from "jsonwebtoken";
import axios from "axios";

// Mock external dependencies
jest.mock("axios");

describe("Posts Service Integration Tests", () => {
  // Test data
  const testUserId = 9999;
  const testPost = {
    caption: "Integration Test Post",
    image_url: "http://example.com/test-image.jpg",
  };
  let createdPostId;
  let gatewaySignature;

  beforeAll(async () => {
    // Create gateway signature for testing
    gatewaySignature = jwt.sign(
      { source: "gateway", timestamp: Date.now() },
      process.env.GATEWAY_SECRET || "gateway-secret-key",
      { expiresIn: "1h" }
    );

    // Mock axios responses for likes service
    axios.get.mockImplementation((url) => {
      if (url.includes("/count")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { count: 5 },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  afterAll(async () => {
    // Clean up
    if (createdPostId) {
      await Post.destroy({
        where: {
          id: createdPostId,
        },
      });
    }

    // Clear Redis cache
    await redisClient.flushall();

    // Close Redis connection
    await redisClient.quit();
  });

  describe("Post Creation and Retrieval Flow", () => {
    it("should create a new post", async () => {
      const response = await request(app)
        .post("/api/posts")
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUserId.toString())
        .send(testPost);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Post created successfully");
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.user_id).toBe(testUserId);
      expect(response.body.data.caption).toBe(testPost.caption);

      // Save post ID for subsequent tests
      createdPostId = response.body.data.id;
    });

    it("should get post by ID", async () => {
      const response = await request(app)
        .get(`/api/posts/${createdPostId}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", createdPostId);
      expect(response.body.data).toHaveProperty("user_id", testUserId);
      expect(response.body.data).toHaveProperty("caption", testPost.caption);
      expect(response.body.data).toHaveProperty("like_count", 5); // From mocked axios response
    });

    it("should get posts by user ID", async () => {
      const response = await request(app)
        .get(`/api/posts/users/${testUserId}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Find our test post in results
      const foundPost = response.body.data.find(
        (post) => post.id === createdPostId
      );
      expect(foundPost).toBeDefined();
      expect(foundPost.caption).toBe(testPost.caption);
    });

    it("should get all posts (feed)", async () => {
      const response = await request(app)
        .get("/api/posts")
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();

      // Our test post should be in the feed
      const foundPost = response.body.data.find(
        (post) => post.id === createdPostId
      );
      expect(foundPost).toBeDefined();
    });

    it("should update a post", async () => {
      const updatedCaption = "Updated Integration Test Post";

      const response = await request(app)
        .put(`/api/posts/${createdPostId}`)
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUserId.toString())
        .send({
          caption: updatedCaption,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("caption", updatedCaption);

      // Verify update was persisted
      const postResponse = await request(app)
        .get(`/api/posts/${createdPostId}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(postResponse.body.data.caption).toBe(updatedCaption);
    });

    it("should delete a post", async () => {
      const response = await request(app)
        .delete(`/api/posts/${createdPostId}`)
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUserId.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Post deleted successfully");

      // Verify post was deleted
      const postResponse = await request(app)
        .get(`/api/posts/${createdPostId}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(postResponse.status).toBe(404);
    });
  });
});
