import request from "supertest";
import app from "../index.js";
import User from "../models/user.js";
import { redisClient } from "../config/redis.js";
import jwt from "jsonwebtoken";
import { consumeMessage } from "../config/kafka.js";

// Mock Kafka consumer
jest.mock("../config/kafka.js", () => ({
  consumeMessage: jest.fn(),
  publishMessage: jest.fn().mockResolvedValue(true),
}));

describe("Users Service Integration Tests", () => {
  // Test user data
  const testUser = {
    id: 9999,
    username: "integrationtestuser",
    email: "integration-test-user@example.com",
    full_name: "Integration Test User",
  };
  let gatewaySignature;

  beforeAll(async () => {
    // Create gateway signature for testing
    gatewaySignature = jwt.sign(
      { source: "gateway", timestamp: Date.now() },
      process.env.GATEWAY_SECRET || "gateway-secret-key",
      { expiresIn: "1h" }
    );

    // Clean up test data
    await User.destroy({
      where: {
        id: testUser.id,
      },
    });

    // Create test user
    await User.create(testUser);
  });

  afterAll(async () => {
    // Clean up
    await User.destroy({
      where: {
        id: testUser.id,
      },
    });

    // Clear Redis cache
    await redisClient.del(`user:${testUser.id}`);

    // Close Redis connection
    await redisClient.quit();
  });

  describe("User Retrieval and Update Flow", () => {
    it("should get user by ID", async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", testUser.id);
      expect(response.body.data).toHaveProperty("username", testUser.username);
      expect(response.body.data).toHaveProperty("email", testUser.email);
    });

    it("should update user profile", async () => {
      const updatedName = "Updated Integration Test User";

      const response = await request(app)
        .put(`/api/users/profile`)
        .set("x-gateway-signature", gatewaySignature)
        .set("x-user-id", testUser.id.toString())
        .send({
          full_name: updatedName,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("full_name", updatedName);

      // Verify update was persisted
      const userResponse = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set("x-gateway-signature", gatewaySignature);

      expect(userResponse.body.data.full_name).toBe(updatedName);
    });

    it("should search users by username", async () => {
      const response = await request(app)
        .get(`/api/users/search?query=integration`)
        .set("x-gateway-signature", gatewaySignature);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Find our test user in results
      const foundUser = response.body.data.find(
        (user) => user.id === testUser.id
      );
      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(testUser.username);
    });

    it("should handle user creation from Kafka event", async () => {
      // Simulate Kafka message for user creation
      const newUser = {
        id: 8888,
        username: "kafkacreateduser",
        email: "kafka-test@example.com",
        full_name: "Kafka Created User",
      };

      // Clean up before test
      await User.destroy({
        where: {
          id: newUser.id,
        },
      });

      // Manually call the handler that would process Kafka message
      const mockMessage = {
        event: "user-created",
        data: newUser,
      };

      // Import the handler directly
      const { createUserFromEvent } = require("../controllers/users.js");
      await createUserFromEvent(newUser);

      // Verify user was created
      const createdUser = await User.findByPk(newUser.id);
      expect(createdUser).not.toBeNull();
      expect(createdUser.username).toBe(newUser.username);

      // Clean up
      await User.destroy({
        where: {
          id: newUser.id,
        },
      });
    });
  });
});
