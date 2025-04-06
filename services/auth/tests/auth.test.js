import { register, login, logout } from "../controllers/auth.js";
import { Auth } from "../models/auth.js";
import { hashPassword, comparePassword } from "../utils/passwordUtils.js";
import { generateToken, invalidateToken } from "../utils/tokenUtils.js";
import { publishMessage } from "../config/kafka.js";

// Mock dependencies
jest.mock("../models/auth.js");
jest.mock("../utils/passwordUtils.js");
jest.mock("../utils/tokenUtils.js");
jest.mock("../config/kafka.js");
jest.mock("../middlewares/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Auth Controller", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
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

  describe("register", () => {
    it("should register a new user successfully", async () => {
      // Arrange
      req.body = {
        username: "testuser",
        email: "test@example.com",
        password: "Password123!",
      };

      Auth.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashedpassword");
      Auth.create.mockResolvedValue({
        id: 1,
        username: "testuser",
        email: "test@example.com",
        created_at: new Date(),
      });
      generateToken.mockResolvedValue({ token: "jwt-token" });
      publishMessage.mockResolvedValue(true);

      // Act
      await register(req, res);

      // Assert
      expect(Auth.create).toHaveBeenCalled();
      expect(generateToken).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: "jwt-token",
          }),
        })
      );
    });
  });

  describe("login", () => {
    it("should login user successfully with valid credentials", async () => {
      // Arrange
      req.body = {
        username: "testuser",
        password: "Password123!",
      };

      Auth.findOne.mockResolvedValue({
        id: 1,
        username: "testuser",
        email: "test@example.com",
        password: "hashedpassword",
      });
      comparePassword.mockResolvedValue(true);
      generateToken.mockResolvedValue({ token: "jwt-token" });

      // Act
      await login(req, res);

      // Assert
      expect(comparePassword).toHaveBeenCalled();
      expect(generateToken).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: "jwt-token",
          }),
        })
      );
    });

    it("should return 401 with invalid credentials", async () => {
      // Arrange
      req.body = {
        username: "testuser",
        password: "WrongPassword",
      };

      Auth.findOne.mockResolvedValue({
        id: 1,
        username: "testuser",
        password: "hashedpassword",
      });
      comparePassword.mockResolvedValue(false);

      // Act
      await login(req, res);

      // Assert
      expect(comparePassword).toHaveBeenCalled();
      expect(generateToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid credentials",
        })
      );
    });
  });
});
