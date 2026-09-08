import { getAuthContext, getOptionalAuthContext, requireAuth } from "@/lib/auth";
import { signAccessToken } from "@/lib/jwt";
import { APIError } from "@/lib/api-error";
import { NextRequest } from "next/server";
import type { UserRole } from "@/types/identity";

// Mock next/headers
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Import after mocking
import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

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

// Test data
const VALID_AUTH_CONTEXT = {
  userId: "64a1b2c3d4e5f6a7b8c9d0e1",
  role: "teacher" as const,
  schoolId: "64a1b2c3d4e5f6a7b8c9d0e0",
};

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAuthContext", () => {
  describe("successful authentication", () => {
    it("should return auth context for valid access token", async () => {
      const token = await signAccessToken(VALID_AUTH_CONTEXT);
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await getAuthContext();

      expect(auth).toEqual({
        userId: VALID_AUTH_CONTEXT.userId,
        role: VALID_AUTH_CONTEXT.role,
        schoolId: VALID_AUTH_CONTEXT.schoolId,
      });
    });

    it("should return exactly userId, role, schoolId", async () => {
      const token = await signAccessToken(VALID_AUTH_CONTEXT);
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await getAuthContext();

      // Should only have these three properties
      expect(Object.keys(auth).sort()).toEqual(["role", "schoolId", "userId"]);
      expect(auth.userId).toBe(VALID_AUTH_CONTEXT.userId);
      expect(auth.role).toBe(VALID_AUTH_CONTEXT.role);
      expect(auth.schoolId).toBe(VALID_AUTH_CONTEXT.schoolId);
    });

    it("should not include JWT standard claims in auth context", async () => {
      const token = await signAccessToken(VALID_AUTH_CONTEXT);
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await getAuthContext();

      // Should not include exp, iat, etc.
      expect(auth).not.toHaveProperty("exp");
      expect(auth).not.toHaveProperty("iat");
    });
  });

  describe("missing authentication", () => {
    it("should throw UNAUTHORIZED when access_token cookie is missing", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        httpStatus: 401,
      });
    });

    it("should throw APIError instance", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      await expect(getAuthContext()).rejects.toBeInstanceOf(APIError);
    });

    it("should use generic error message for missing token", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      await expect(getAuthContext()).rejects.toMatchObject({
        message: "Authentication required",
      });
    });
  });

  describe("malformed JWT", () => {
    it("should throw UNAUTHORIZED for malformed JWT", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("not.a.valid.jwt"));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED for completely invalid string", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-token"));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED for empty token", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(""));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });
  });

  describe("expired JWT", () => {
    it("should throw UNAUTHORIZED for expired token", async () => {
      // Create a token that's already expired
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);

      const expiredToken = await new SignJWT({
        userId: "test",
        role: "teacher",
        schoolId: "test",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 1000)
        .setExpirationTime(now - 500) // Expired 500 seconds ago
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        httpStatus: 401,
      });
    });
  });

  describe("incorrectly signed JWT", () => {
    it("should throw UNAUTHORIZED for token signed with wrong secret", async () => {
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret-key-different!");

      const badToken = await new SignJWT({
        userId: "test",
        role: "teacher",
        schoolId: "test",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      mockCookies.mockResolvedValue(createMockCookieStore(badToken));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should not expose jose signature verification errors", async () => {
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret!");

      const badToken = await new SignJWT({
        userId: "test",
        role: "teacher",
        schoolId: "test",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      mockCookies.mockResolvedValue(createMockCookieStore(badToken));

      try {
        await getAuthContext();
        fail("Should have thrown");
      } catch (error) {
        if (error instanceof APIError) {
          // Should not contain jose error details
          expect(error.message).toBe("Authentication required");
          expect(error.message).not.toContain("signature");
          expect(error.message).not.toContain("jose");
          expect(error.message).not.toContain("JWS");
        } else {
          fail("Should throw APIError");
        }
      }
    });
  });

  describe("missing required claims", () => {
    it("should throw UNAUTHORIZED when userId is missing", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);

      const tokenWithoutUserId = await new SignJWT({
        role: "teacher",
        schoolId: "test",
        // userId missing
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(tokenWithoutUserId));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED when role is missing", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);

      const tokenWithoutRole = await new SignJWT({
        userId: "test",
        schoolId: "test",
        // role missing
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(tokenWithoutRole));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED when schoolId is missing", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);

      const tokenWithoutSchoolId = await new SignJWT({
        userId: "test",
        role: "teacher",
        // schoolId missing
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(tokenWithoutSchoolId));

      await expect(getAuthContext()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });
  });

  describe("error message security", () => {
    it("should use generic message for all authentication failures", async () => {
      const testCases = [
        { desc: "missing cookie", value: undefined },
        { desc: "empty token", value: "" },
        { desc: "malformed token", value: "invalid" },
      ];

      for (const testCase of testCases) {
        mockCookies.mockResolvedValue(
          createMockCookieStore(testCase.value || undefined)
        );

        try {
          await getAuthContext();
          fail(`Should have thrown for ${testCase.desc}`);
        } catch (error) {
          if (error instanceof APIError) {
            expect(error.message).toBe("Authentication required");
          }
        }
      }
    });

    it("should not reveal whether token was expired vs invalid signature", async () => {
      // This test verifies that error messages are generic
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const wrongSecret = new TextEncoder().encode("wrong-secret!");
      const now = Math.floor(Date.now() / 1000);

      // Expired token
      const expiredToken = await new SignJWT({
        userId: "test",
        role: "teacher",
        schoolId: "test",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 1000)
        .setExpirationTime(now - 500)
        .sign(secret);

      // Wrong signature token
      const wrongSigToken = await new SignJWT({
        userId: "test",
        role: "teacher",
        schoolId: "test",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      // Both should produce the same error message
      const errors: string[] = [];

      for (const token of [expiredToken, wrongSigToken]) {
        mockCookies.mockResolvedValue(createMockCookieStore(token));

        try {
          await getAuthContext();
        } catch (error) {
          if (error instanceof APIError) {
            errors.push(error.message);
          }
        }
      }

      // All errors should be identical
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBe("Authentication required");
      expect(errors[1]).toBe("Authentication required");
    });
  });
});

describe("getOptionalAuthContext", () => {
  it("should return auth context for valid token", async () => {
    const token = await signAccessToken(VALID_AUTH_CONTEXT);

    mockCookies.mockResolvedValue(createMockCookieStore(token));

    const auth = await getOptionalAuthContext();

    expect(auth).toEqual({
      userId: VALID_AUTH_CONTEXT.userId,
      role: VALID_AUTH_CONTEXT.role,
      schoolId: VALID_AUTH_CONTEXT.schoolId,
    });
  });

  it("should return null for missing token", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));

    const auth = await getOptionalAuthContext();

    expect(auth).toBeNull();
  });

  it("should return null for invalid token", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("invalid-token"));

    const auth = await getOptionalAuthContext();

    expect(auth).toBeNull();
  });

  it("should return null for expired token", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(TEST_SECRET);
    const now = Math.floor(Date.now() / 1000);

    const expiredToken = await new SignJWT({
      userId: "test",
      role: "teacher",
      schoolId: "test",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 500)
      .sign(secret);

    mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));

    const auth = await getOptionalAuthContext();

    expect(auth).toBeNull();
  });

  it("should not throw for authentication failures", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));

    // Should not throw
    await expect(getOptionalAuthContext()).resolves.toBeNull();
  });
});

describe("requireAuth", () => {
  // Helper to create a mock NextRequest
  function createMockRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/test");
  }

  describe("authentication failures", () => {
    it("should throw UNAUTHORIZED when no authentication", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      await expect(requireAuth(createMockRequest())).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED for invalid token", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-token"));

      await expect(requireAuth(createMockRequest())).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should throw UNAUTHORIZED before checking roles", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      // Should fail with UNAUTHORIZED, not FORBIDDEN
      await expect(
        requireAuth(createMockRequest(), "admin")
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });
  });

  describe("no role restrictions", () => {
    it("should succeed for any authenticated user when no roles specified", async () => {
      const token = await signAccessToken({
        userId: "user123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest());

      expect(auth).toEqual({
        userId: "user123",
        role: "student",
        schoolId: "school123",
      });
    });

    it("should accept admin without role check", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest());

      expect(auth.role).toBe("admin");
    });

    it("should accept teacher without role check", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest());

      expect(auth.role).toBe("teacher");
    });
  });

  describe("single role restriction", () => {
    it("should succeed when user has the required admin role", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest(), "admin");

      expect(auth).toEqual({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
    });

    it("should succeed when user has the required teacher role", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest(), "teacher");

      expect(auth).toEqual({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
    });

    it("should throw FORBIDDEN when teacher tries admin-only route", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "admin")
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Access denied. Required role: admin",
        httpStatus: 403,
      });
    });

    it("should throw FORBIDDEN when student tries teacher route", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "teacher")
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        httpStatus: 403,
      });
    });

    it("should throw APIError instance for role mismatch", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "admin")
      ).rejects.toBeInstanceOf(APIError);
    });
  });

  describe("multiple role restrictions", () => {
    it("should succeed when student tries student or teacher route", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest(), "student", "teacher");

      expect(auth.role).toBe("student");
    });

    it("should succeed when teacher tries teacher or admin route", async () => {
      const token = await signAccessToken({
        userId: "teacher123",
        role: "teacher",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest(), "teacher", "admin");

      expect(auth.role).toBe("teacher");
    });

    it("should succeed when admin tries teacher or admin route", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest(), "teacher", "admin");

      expect(auth.role).toBe("admin");
    });

    it("should succeed when counselor tries admin or counselor route", async () => {
      const token = await signAccessToken({
        userId: "counselor123",
        role: "counselor",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(
        createMockRequest(),
        "admin",
        "counselor"
      );

      expect(auth.role).toBe("counselor");
    });

    it("should throw FORBIDDEN when student tries teacher or admin route", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "teacher", "admin")
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        httpStatus: 403,
      });
    });

    it("should throw FORBIDDEN when parent tries teacher or admin route", async () => {
      const token = await signAccessToken({
        userId: "parent123",
        role: "parent",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "teacher", "admin")
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        httpStatus: 403,
      });
    });

    it("should format multiple roles in error message with or", async () => {
      const token = await signAccessToken({
        userId: "student123",
        role: "student",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      await expect(
        requireAuth(createMockRequest(), "teacher", "admin")
      ).rejects.toMatchObject({
        message: "Access denied. Required role: teacher or admin",
      });
    });
  });

  describe("all user roles", () => {
    const roles: Array<{ role: "student" | "parent" | "teacher" | "counselor" | "admin"; userId: string }> = [
      { role: "student", userId: "student123" },
      { role: "parent", userId: "parent123" },
      { role: "teacher", userId: "teacher123" },
      { role: "counselor", userId: "counselor123" },
      { role: "admin", userId: "admin123" },
    ];

    it("should authenticate all valid user roles without restrictions", async () => {
      for (const { role, userId } of roles) {
        const token = await signAccessToken({
          userId,
          role,
          schoolId: "school123",
        });
        mockCookies.mockResolvedValue(createMockCookieStore(token));

        const auth = await requireAuth(createMockRequest());

        expect(auth.role).toBe(role);
        expect(auth.userId).toBe(userId);
      }
    });

    it("should respect role restrictions for all user types", async () => {
      for (const { role, userId } of roles) {
        const token = await signAccessToken({
          userId,
          role,
          schoolId: "school123",
        });
        mockCookies.mockResolvedValue(createMockCookieStore(token));

        // Each role should succeed with itself
        const auth = await requireAuth(createMockRequest(), role);

        expect(auth.role).toBe(role);
      }
    });
  });

  describe("return value", () => {
    it("should return complete auth context with userId, role, schoolId", async () => {
      const token = await signAccessToken({
        userId: "user123",
        role: "teacher",
        schoolId: "school456",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const auth = await requireAuth(createMockRequest());

      expect(auth).toHaveProperty("userId", "user123");
      expect(auth).toHaveProperty("role", "teacher");
      expect(auth).toHaveProperty("schoolId", "school456");
    });

    it("should return same context as getAuthContext", async () => {
      const token = await signAccessToken(VALID_AUTH_CONTEXT);
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const authFromRequire = await requireAuth(createMockRequest());
      mockCookies.mockResolvedValue(createMockCookieStore(token));
      const authFromGet = await getAuthContext();

      expect(authFromRequire).toEqual(authFromGet);
    });
  });

  describe("edge cases", () => {
    it("should handle expired token with role check", async () => {
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

      // Should fail with UNAUTHORIZED, not FORBIDDEN
      await expect(
        requireAuth(createMockRequest(), "admin")
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should handle malformed token with role check", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("malformed-jwt"));

      await expect(
        requireAuth(createMockRequest(), "admin")
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
    });

    it("should handle case-sensitive role matching", async () => {
      const token = await signAccessToken({
        userId: "admin123",
        role: "admin",
        schoolId: "school123",
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      // Role must match exactly (case-sensitive)
      await expect(
        requireAuth(createMockRequest(), "Admin" as unknown as UserRole)
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        httpStatus: 403,
      });
    });
  });
});
