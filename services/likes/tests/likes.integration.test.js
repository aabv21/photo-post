import request from "supertest";
import app from "../index.js";
import { Like } from "../models/like.js";
import { redisClient } from "../config/redis.js";
import jwt from "jsonwebtoken";

describe("Likes Service Integration Tests", () => {
  // Mock user and post data
  const testUserId = 999;
  const testPostId = 888;
  let gatewaySignature;

  beforeAll(async () => {
    // Create gateway signature for testing
    gatewaySignature = jwt.sign(
      { source: "gateway", timestamp: Date.now() },
      process.env.GATEWAY_SECRET || "gateway-secret-key",
      { expiresIn: "1h" }
    );

    // Clean up test data
    await Like.destroy({
      where: {
        user_id: testUserId,
        post_id: testPostId,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await Like.destroy({
      where: {
        user_id: testUserId,
        post_id: testPostId,
      },
    });

    // Close Redis connection
    await redisClient.quit();
  });

  describe("Like Creation and Retrieval Flow", () => {
    it("should create a new like", async () => {
      const response = await request(app)
        .post(`/api/likes/posts/${testPostId}`)
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUserId.toString());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Post liked successfully");
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.post_id).toBe(testPostId);
      expect(response.body.data.user_id).toBe(testUserId);
    });

    it("should get likes for a post", async () => {
      const response = await request(app)
        .get(`/api/likes/posts/${testPostId}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("post_id", testPostId);
      expect(response.body.data[0]).toHaveProperty("user_id", testUserId);
    });

    it("should get like count for a post", async () => {
      const response = await request(app)
        .get(`/api/likes/posts/${testPostId}/count`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("count");
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it("should delete a like", async () => {
      const response = await request(app)
        .delete(`/api/likes/posts/${testPostId}`)
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUserId.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Like removed successfully");

      // Verify like was deleted
      const countResponse = await request(app)
        .get(`/api/likes/posts/${testPostId}/count`)
        .set("x-gateway-signature", gatewaySignature);

      expect(countResponse.body.data.count).toBe(0);
    });
  });
});
