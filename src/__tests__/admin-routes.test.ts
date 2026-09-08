/**
 * Tests for protected admin routes
 * 
 * Tests JWT-based authentication and authorization for:
 * - POST /api/v1/admin/users
 * - DELETE /api/v1/admin/users/[userId]
 * - POST /api/v1/admin/broadcast
 */

import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { POST as createUser } from "@/app/api/v1/admin/users/route";
import { DELETE as deleteUser } from "@/app/api/v1/admin/users/[userId]/route";
import { POST as broadcastEmergency } from "@/app/api/v1/admin/broadcast/route";

// Mock next/headers
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Mock database connection
jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

// Mock User model
jest.mock("@/models", () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock AdminService
jest.mock("@/services/admin.service", () => ({
  AdminService: {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    broadcastEmergency: jest.fn(),
    getUsers: jest.fn(),
  },
}));

import { cookies } from "next/headers";
import { AdminService } from "@/services/admin.service";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockAdminService = AdminService as jest.Mocked<typeof AdminService>;

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";

// Helper to create mock cookie store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockCookieStore(cookieValue: string | undefined): any {
  return {
    get: jest.fn((name: string) => {
      if (name === "access_token" && cookieValue !== undefined) {
        return { name, value: cookieValue };
      }
      return undefined;
    }),
  };
}

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/v1/admin/users", () => {
  const createValidRequest = (body: unknown, headers?: Record<string, string>) => {
    const url = "http://localhost:3000/api/v1/admin/users";
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  describe("authentication failures", () => {
    it("should return 401 when no access_token cookie", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when JWT is invalid", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-jwt-token"));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when JWT is expired", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);

      const expiredToken = await new SignJWT({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 1000)
        .setExpirationTime(now - 500)
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("authorization failures", () => {
    it("should return 403 when user has student role", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when user has teacher role", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when user has parent role", async () => {
      const token = await signAccessToken({
        userId: "parent123",
        role: "parent",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when user has counselor role", async () => {
      const token = await signAccessToken({
        userId: "counselor123",
        role: "counselor",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should NOT trust x-user-role header without valid admin JWT", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest(
        {
          email: "test@example.com",
          role: "teacher",
        },
        {
          "x-user-role": "admin", // Forged header
        }
      );

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should NOT trust x-user-role header with valid non-admin JWT", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest(
        {
          email: "test@example.com",
          role: "teacher",
        },
        {
          "x-user-role": "admin", // Forged header
        }
      );

      const response = await createUser(request);
      const data = await response.json();

      // Should still be 403 because JWT role is teacher
      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("successful admin authentication", () => {
    it("should succeed when user has valid admin JWT", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.createUser.mockResolvedValue({
        _id: "newuser123",
        email: "test@example.com",
        role: "teacher",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockAdminService.createUser).toHaveBeenCalled();
    });

    it("should use authenticated admin userId from JWT", async () => {
      const token = await signAccessToken({
        userId: "admin456",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.createUser.mockResolvedValue({
        _id: "newuser123",
        email: "test@example.com",
        role: "teacher",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
      });

      await createUser(request);

      // Verify createUser called with admin userId from JWT
      expect(mockAdminService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          role: "teacher",
          schoolId: "school123",
        }),
        "admin456" // userId from JWT
      );
    });
  });

  describe("school isolation", () => {
    it("should enforce authenticated admin schoolId", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.createUser.mockResolvedValue({
        _id: "newuser123",
        email: "test@example.com",
        role: "teacher",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
        schoolId: "schoolA",
      });

      await createUser(request);

      // Verify schoolId from JWT was used
      expect(mockAdminService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "schoolA",
        }),
        "admin123"
      );
    });

    it("should reject request with different schoolId than authenticated admin", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
        schoolId: "schoolB", // Different school
      });

      const response = await createUser(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toContain("other schools");
      expect(mockAdminService.createUser).not.toHaveBeenCalled();
    });

    it("should override client schoolId with authenticated schoolId", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.createUser.mockResolvedValue({
        _id: "newuser123",
        email: "test@example.com",
        role: "teacher",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        email: "test@example.com",
        role: "teacher",
        // No schoolId in body
      });

      await createUser(request);

      // Verify schoolId from JWT was used
      expect(mockAdminService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "schoolA", // From JWT, not body
        }),
        "admin123"
      );
    });
  });
});

describe("DELETE /api/v1/admin/users/[userId]", () => {
  const createValidRequest = (userId: string, headers?: Record<string, string>) => {
    const url = `http://localhost:3000/api/v1/admin/users/${userId}`;
    return new NextRequest(url, {
      method: "DELETE",
      headers: headers,
    });
  };

  describe("authentication failures", () => {
    it("should return 401 when no access_token cookie", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest("user123");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when JWT is invalid", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-jwt"));

      const request = createValidRequest("user123");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("authorization failures", () => {
    it("should return 403 when user has non-admin role", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest("user123");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when user has counselor role", async () => {
      const token = await signAccessToken({
        userId: "counselor123",
        role: "counselor",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest("user123");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should NOT trust forged x-user-role header", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest("user123", {
        "x-user-role": "admin",
      });
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should NOT trust forged x-user-role header with valid non-admin JWT", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest("user123", {
        "x-user-role": "admin",
      });
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("successful admin authentication", () => {
    it("should proceed with valid admin JWT", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.deleteUser.mockResolvedValue({
        _id: "user123",
        email: "user@example.com",
        isActive: false,
        message: "User successfully deactivated.",
      });

      const request = createValidRequest("user123");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockAdminService.deleteUser).toHaveBeenCalled();
    });

    it("should use authenticated admin userId from JWT", async () => {
      const token = await signAccessToken({
        userId: "admin456",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.deleteUser.mockResolvedValue({
        _id: "user123",
        email: "user@example.com",
        isActive: false,
        message: "User successfully deactivated.",
      });

      const request = createValidRequest("user123");
      await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });

      expect(mockAdminService.deleteUser).toHaveBeenCalledWith(
        "user123",
        "admin456", // adminUserId from JWT
        "school123" // schoolId from JWT
      );
    });
  });

  describe("school isolation", () => {
    it("should enforce school isolation via schoolId parameter", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.deleteUser.mockResolvedValue({
        _id: "user123",
        email: "user@example.com",
        isActive: false,
        message: "User successfully deactivated.",
      });

      const request = createValidRequest("user123");
      await deleteUser(request, {
        params: Promise.resolve({ userId: "user123" }),
      });

      // Verify deleteUser called with schoolId for isolation
      expect(mockAdminService.deleteUser).toHaveBeenCalledWith(
        "user123",
        "admin123",
        "schoolA" // School isolation parameter
      );
    });

    it("should return 404 when targeting user from another school", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      // Mock service throws APIError.notFound for cross-school access
      const { APIError } = await import("@/lib/api-error");
      mockAdminService.deleteUser.mockRejectedValue(
        APIError.notFound("User 'userFromSchoolB' not found.")
      );

      const request = createValidRequest("userFromSchoolB");
      const response = await deleteUser(request, {
        params: Promise.resolve({ userId: "userFromSchoolB" }),
      });

      expect(response.status).toBe(404);
    });
  });
});

describe("POST /api/v1/admin/broadcast", () => {
  const createValidRequest = (body: unknown, headers?: Record<string, string>) => {
    const url = "http://localhost:3000/api/v1/admin/broadcast";
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  describe("authentication failures", () => {
    it("should return 401 when no access_token cookie", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when JWT is invalid", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-jwt"));

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("authorization failures", () => {
    it("should return 403 when user has non-admin role", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should NOT trust forged x-user-role header without JWT", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const request = createValidRequest(
        {
          title: "Emergency",
          message: "Test alert",
          severity: "high",
          targetAudience: "all",
        },
        {
          "x-user-role": "admin",
        }
      );

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should NOT trust forged x-user-role header with non-admin JWT", async () => {
      const token = await signAccessToken({
        userId: "counselor123",
        role: "counselor",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const request = createValidRequest(
        {
          title: "Emergency",
          message: "Test alert",
          severity: "high",
          targetAudience: "all",
        },
        {
          "x-user-role": "admin",
        }
      );

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("successful admin authentication", () => {
    it("should proceed with valid admin JWT", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.broadcastEmergency.mockResolvedValue({
        _id: "alert123",
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        createdBy: "admin123",
        schoolId: "school123",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      const response = await broadcastEmergency(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockAdminService.broadcastEmergency).toHaveBeenCalled();
    });

    it("should use authenticated admin userId from JWT", async () => {
      const token = await signAccessToken({
        userId: "admin789",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.broadcastEmergency.mockResolvedValue({
        _id: "alert123",
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        createdBy: "admin789",
        schoolId: "school123",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      await broadcastEmergency(request);

      expect(mockAdminService.broadcastEmergency).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Emergency",
          message: "Test alert",
          schoolId: "school123",
        }),
        "admin789" // adminUserId from JWT
      );
    });
  });

  describe("school isolation", () => {
    it("should enforce authenticated admin schoolId", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.broadcastEmergency.mockResolvedValue({
        _id: "alert123",
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        createdBy: "admin123",
        schoolId: "schoolA",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
      });

      await broadcastEmergency(request);

      // Verify broadcast data includes schoolId from JWT
      expect(mockAdminService.broadcastEmergency).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "schoolA", // From JWT
        }),
        "admin123"
      );
    });

    it("should override client-supplied schoolId with authenticated schoolId", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "schoolA",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      mockAdminService.broadcastEmergency.mockResolvedValue({
        _id: "alert123",
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        createdBy: "admin123",
        schoolId: "schoolA",
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const request = createValidRequest({
        title: "Emergency",
        message: "Test alert",
        severity: "critical",
        targetAudience: "all",
        schoolId: "schoolB", // Client tries to broadcast to different school
      });

      await broadcastEmergency(request);

      // Verify schoolId from JWT overrides client-supplied schoolId
      expect(mockAdminService.broadcastEmergency).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "schoolA", // From JWT, not client
        }),
        "admin123"
      );
    });
  });
});
