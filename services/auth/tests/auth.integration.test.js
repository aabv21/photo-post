import request from "supertest";
import app from "../index.js";
import { Auth } from "../models/auth.js";
import { redisClient } from "../config/redis.js";
import { publishMessage } from "../config/kafka.js";

// Mock external dependencies
jest.mock("../config/kafka.js", () => ({
  publishMessage: jest.fn().mockResolvedValue(true),
}));

// Use actual database but with transaction rollback
let transaction;

describe("Auth Service Integration Tests", () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Clear test data
    await Auth.destroy({
      where: {
        email: "integration-test@example.com",
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await Auth.destroy({
      where: {
        email: "integration-test@example.com",
      },
    });

    // Close Redis connection
    await redisClient.quit();
  });

  describe("User Registration and Authentication Flow", () => {
    it("should register a new user", async () => {
      const response = await request(app).post("/api/auth/register").send({
        username: "integrationtest",
        email: "integration-test@example.com",
        password: "Integration123!",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.user).toHaveProperty("id");
      expect(response.body.data.user.username).toBe("integrationtest");

      // Save user data for subsequent tests
      testUser = response.body.data.user;
      authToken = response.body.data.token;

      // Verify Kafka message was published
      expect(publishMessage).toHaveBeenCalledWith(
        "user-events",
        expect.objectContaining({
          event: "user-created",
          data: expect.objectContaining({
            id: testUser.id,
            username: "integrationtest",
          }),
        })
      );
    });

    it("should login with valid credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: "integrationtest",
        password: "Integration123!",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.user.id).toBe(testUser.id);

      // Update token for subsequent tests
      authToken = response.body.data.token;
    });

    it("should get current user with valid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", testUser.id);
      expect(response.body.data).toHaveProperty("username", "integrationtest");
    });

    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Logout successful");

      // Verify token is invalidated by trying to access protected route
      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(meResponse.status).toBe(401);
    });
  });
});
