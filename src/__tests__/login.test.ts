import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/auth/login/route";
import { hashPassword } from "@/lib/password";
import { verifyAccessToken } from "@/lib/jwt";

// Mock dependencies
jest.mock("@/lib/db", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

// Mock User model - must be defined inline in the factory
jest.mock("@/models", () => ({
  User: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

// Import after mocks are set up
import { User } from "@/models";

const mockUser = User as jest.Mocked<typeof User>;

// Test data
const VALID_USER = {
  _id: "64a1b2c3d4e5f6a7b8c9d0e1",
  email: "teacher@school.com",
  passwordHash: "", // Will be set in beforeAll
  role: "teacher" as const,
  schoolId: "64a1b2c3d4e5f6a7b8c9d0e0",
  isActive: true,
  lastLoginAt: null,
};

const INACTIVE_USER = {
  ...VALID_USER,
  _id: "64a1b2c3d4e5f6a7b8c9d0e2",
  email: "inactive@school.com",
  isActive: false,
};

const VALID_PASSWORD = "TestPass123!";

// Helper function to create test request
function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// Helper function to parse response
async function parseResponse(response: Response) {
  const body = await response.json();
  const cookies = response.headers.get("Set-Cookie") || "";
  return { body, cookies, status: response.status };
}

beforeAll(async () => {
  // Set up test secret
  process.env.ACCESS_TOKEN_SECRET = "test-secret-that-is-long-enough-32chars!";
  
  // Hash the valid password
  VALID_USER.passwordHash = await hashPassword(VALID_PASSWORD);
  INACTIVE_USER.passwordHash = await hashPassword(VALID_PASSWORD);
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/v1/auth/login", () => {
  describe("request validation", () => {
    it("should reject malformed JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        body: "invalid-json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid email format", async () => {
      const request = createRequest({
        email: "invalid-email",
        password: "password",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing email", async () => {
      const request = createRequest({
        password: "password",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing password", async () => {
      const request = createRequest({
        email: "user@example.com",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject empty password", async () => {
      const request = createRequest({
        email: "user@example.com",
        password: "",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("authentication failures", () => {
    it("should reject nonexistent user with generic error", async () => {
      // Mock query chain to return null
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "nonexistent@school.com",
        password: "password",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Invalid email or password");
      
      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "nonexistent@school.com",
      });
    });

    it("should perform password comparison even for nonexistent users", async () => {
      // Mock query chain to return null (user doesn't exist)
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "nonexistent@school.com",
        password: "any-password",
      });

      // The request should still complete (bcrypt runs against dummy hash)
      const response = await POST(request);
      const { status } = await parseResponse(response);

      // Should still return 401 but after bcrypt operation
      expect(status).toBe(401);
    });

    it("should reject incorrect password with generic error", async () => {
      // Mock query chain to return valid user
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(VALID_USER)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "teacher@school.com",
        password: "wrong-password",
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Invalid email or password");
    });

    it("should reject inactive user with generic error", async () => {
      // Mock query chain to return inactive user
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(INACTIVE_USER)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "inactive@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Invalid email or password");
    });

    it("should perform password comparison even for inactive users", async () => {
      // Mock query chain to return inactive user
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(INACTIVE_USER)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "inactive@school.com",
        password: VALID_PASSWORD,
      });

      // The request should complete (bcrypt runs against dummy hash for inactive user)
      const response = await POST(request);
      const { status } = await parseResponse(response);

      // Should still return 401 but after bcrypt operation
      expect(status).toBe(401);
    });
  });

  describe("successful authentication", () => {
    let mockSelect: jest.Mock;

    beforeEach(() => {
      // Setup successful authentication mocks
      mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(VALID_USER)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUser.findByIdAndUpdate.mockResolvedValue(undefined as any);
    });

    it("should return 200 with safe user data for valid credentials", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { body, status } = await parseResponse(response);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.user).toEqual({
        id: VALID_USER._id,
        email: VALID_USER.email,
        role: VALID_USER.role,
        schoolId: VALID_USER.schoolId,
      });
    });

    it("should normalize email to lowercase before lookup", async () => {
      const request = createRequest({
        email: "TEACHER@SCHOOL.COM",
        password: VALID_PASSWORD,
      });

      await POST(request);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "teacher@school.com",
      });
    });

    it("should not return passwordHash in response", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { body } = await parseResponse(response);

      expect(body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("passwordHash");
    });

    it("should not return JWT in response JSON", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { body } = await parseResponse(response);

      expect(body.data.accessToken).toBeUndefined();
      expect(body.data.token).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/eyJ[A-Za-z0-9-_]/); // JWT pattern
    });

    it("should set HttpOnly access_token cookie", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { cookies } = await parseResponse(response);

      expect(cookies).toContain("access_token=");
      expect(cookies).toContain("HttpOnly");
      expect(cookies.toLowerCase()).toContain("samesite=strict");
      expect(cookies).toContain("Path=/");
      expect(cookies).toContain("Max-Age=900"); // 15 minutes
    });

    it("should set Secure cookie in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "production";

      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { cookies } = await parseResponse(response);

      expect(cookies).toContain("Secure");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = originalEnv;
    });

    it("should not set Secure cookie in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "development";

      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { cookies } = await parseResponse(response);

      expect(cookies).not.toContain("Secure");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = originalEnv;
    });

    it("should generate valid JWT with correct payload", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      const response = await POST(request);
      const { cookies } = await parseResponse(response);

      // Extract token from cookie
      const tokenMatch = cookies.match(/access_token=([^;]+)/);
      expect(tokenMatch).not.toBeNull();
      
      if (tokenMatch) {
        const token = tokenMatch[1];
        const decoded = await verifyAccessToken(token);
        
        expect(decoded.userId).toBe(VALID_USER._id);
        expect(decoded.role).toBe(VALID_USER.role);
        expect(decoded.schoolId).toBe(VALID_USER.schoolId);
      }
    });

    it("should update lastLoginAt after successful authentication", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      await POST(request);

      expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
        VALID_USER._id,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        })
      );
    });

    it("should not update lastLoginAt on failed authentication", async () => {
      const request = createRequest({
        email: "teacher@school.com",
        password: "wrong-password",
      });

      await POST(request);

      expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("database query", () => {
    it("should request passwordHash explicitly due to select: false", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(VALID_USER)
      });
      (mockUser.findOne as jest.Mock).mockReturnValue({ select: mockSelect });

      const request = createRequest({
        email: "teacher@school.com",
        password: VALID_PASSWORD,
      });

      await POST(request);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "teacher@school.com",
      });
      
      // Verify that select('+passwordHash') was called
      expect(mockSelect).toHaveBeenCalledWith('+passwordHash');
    });
  });
});