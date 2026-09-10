/**
 * Login flow integration tests
 *
 * Tests POST /api/v1/auth/login:
 *   - valid credentials authenticate correctly
 *   - invalid password is rejected
 *   - non-existent email is rejected
 *   - access_token HttpOnly cookie is set on success
 *   - JWT is NOT present in the JSON response body
 *   - generic error messages (no user-exists enumeration)
 *
 * Password utilities are mocked so tests run at jest speed, not bcrypt
 * cost-12 speed. The real hashPassword/comparePassword behaviour is
 * covered by the existing password.test.ts suite.
 */

import { NextRequest } from "next/server";
import mongoose from "mongoose";

// ── Mock DB connection ────────────────────────────────────────────────────────
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));

// ── Mock password utilities ───────────────────────────────────────────────────
// Use synchronous stand-ins so tests don't wait for real bcrypt rounds.
jest.mock("@/lib/password", () => ({
  DUMMY_PASSWORD_HASH: "dummy-hash",
  hashPassword: jest.fn(async (pw: string) => `hashed:${pw}`),
  comparePassword: jest.fn(async (pw: string, hash: string) =>
    hash === `hashed:${pw}`
  ),
}));

// ── Mock User model ───────────────────────────────────────────────────────────
jest.mock("@/models", () => ({
  User: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

import { POST as loginHandler } from "@/app/api/v1/auth/login/route";
import { User } from "@/models";

const mockFindOne = User.findOne as jest.MockedFunction<typeof User.findOne>;
const mockUpdate = User.findByIdAndUpdate as jest.MockedFunction<
  typeof User.findByIdAndUpdate
>;

// ── Constants ─────────────────────────────────────────────────────────────────
const DEMO_PASSWORD = "Password123!";
const DEMO_HASH = `hashed:${DEMO_PASSWORD}`; // matches the mock comparePassword logic
const SCHOOL_ID = new mongoose.Types.ObjectId().toHexString();
const USER_ID = new mongoose.Types.ObjectId().toHexString();

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMockUser(overrides: Record<string, any> = {}): any {
  return {
    _id: new mongoose.Types.ObjectId(USER_ID),
    email: "admin@edushield.org",
    role: "admin",
    schoolId: new mongoose.Types.ObjectId(SCHOOL_ID),
    isActive: true,
    passwordHash: DEMO_HASH,
    ...overrides,
  };
}

/** Build a findOne().select().lean() call chain returning `resolved` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(resolved: any) {
  const chain = {
    select: jest.fn(),
    lean: jest.fn().mockResolvedValue(resolved),
  };
  chain.select.mockReturnValue(chain);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockFindOne.mockReturnValue(chain as any);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET =
    "test-secret-that-is-long-enough-32chars!";
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUpdate.mockResolvedValue(null as any);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/login", () => {

  // ── 1. Valid credentials ────────────────────────────────────────────────────
  describe("valid credentials", () => {
    it("returns 200 and success:true for correct demo credentials", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns the authenticated user's role in the response body", async () => {
      mockChain(makeMockUser({ role: "admin" }));

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const body = await res.json();

      expect(body.data.user.role).toBe("admin");
    });

    it("response user object contains id, email, role, schoolId", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const { data } = await res.json();

      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("email", "admin@edushield.org");
      expect(data.user).toHaveProperty("role", "admin");
      expect(data.user).toHaveProperty("schoolId");
    });

    it("does NOT include the JWT token in the JSON response body", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const bodyStr = JSON.stringify(await res.json());

      // A JWT is three base64url segments separated by dots
      expect(bodyStr).not.toMatch(
        /ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
      );
    });

    it("sets access_token as an HttpOnly cookie on success", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );

      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toMatch(/access_token=/);
      expect(setCookie).toMatch(/HttpOnly/i);
    });

    it("sets SameSite=Strict on the cookie", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const setCookie = res.headers.get("set-cookie") ?? "";

      expect(setCookie).toMatch(/SameSite=Strict/i);
    });

    it("calls findByIdAndUpdate to record lastLoginAt after success", async () => {
      mockChain(makeMockUser());

      await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lastLoginAt: expect.any(Date) })
      );
    });
  });

  // ── 2. Invalid password ─────────────────────────────────────────────────────
  describe("invalid password", () => {
    it("returns 401 for an incorrect password", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: "WrongPass!" })
      );

      expect(res.status).toBe(401);
    });

    it("returns UNAUTHORIZED error code for wrong password", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: "WrongPass!" })
      );
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("uses a generic error message — does not hint password was wrong", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: "WrongPass!" })
      );
      const body = await res.json();

      expect(body.error.message).toBe("Invalid email or password");
    });

    it("does NOT call findByIdAndUpdate on failed auth", async () => {
      mockChain(makeMockUser());

      await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: "WrongPass!" })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ── 3. Non-existent email ───────────────────────────────────────────────────
  describe("non-existent email", () => {
    it("returns 401 for an unknown email address", async () => {
      mockChain(null); // user not found

      const res = await loginHandler(
        makeRequest({ email: "ghost@nowhere.com", password: DEMO_PASSWORD })
      );

      expect(res.status).toBe(401);
    });

    it("returns the same generic message as wrong-password (no enumeration)", async () => {
      mockChain(null);

      const res = await loginHandler(
        makeRequest({ email: "ghost@nowhere.com", password: DEMO_PASSWORD })
      );
      const body = await res.json();

      expect(body.error.message).toBe("Invalid email or password");
    });
  });

  // ── 4. Inactive account ─────────────────────────────────────────────────────
  describe("inactive account", () => {
    it("returns 401 for an inactive user even with correct password", async () => {
      mockChain(makeMockUser({ isActive: false }));

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );

      expect(res.status).toBe(401);
    });
  });

  // ── 5. Input validation ─────────────────────────────────────────────────────
  describe("input validation", () => {
    it("returns 422 when email is missing", async () => {
      const res = await loginHandler(
        makeRequest({ password: DEMO_PASSWORD })
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when password is missing", async () => {
      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org" })
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 for a malformed email format", async () => {
      const res = await loginHandler(
        makeRequest({ email: "not-an-email", password: DEMO_PASSWORD })
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 for an empty-string password", async () => {
      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: "" })
      );
      expect(res.status).toBe(422);
    });
  });

  // ── 6. Security ─────────────────────────────────────────────────────────────
  describe("security", () => {
    it("does not expose any bcrypt hash fragment in error responses", async () => {
      mockChain(null);

      const res = await loginHandler(
        makeRequest({ email: "ghost@nowhere.com", password: "bad" })
      );
      const bodyStr = JSON.stringify(await res.json());

      // bcrypt hashes start with $2a$ or $2b$
      expect(bodyStr).not.toMatch(/\$2[ab]\$/);
    });

    it("does not expose ACCESS_TOKEN_SECRET in responses", async () => {
      mockChain(makeMockUser());

      const res = await loginHandler(
        makeRequest({ email: "admin@edushield.org", password: DEMO_PASSWORD })
      );
      const bodyStr = JSON.stringify(await res.json());

      expect(bodyStr).not.toContain(
        process.env.ACCESS_TOKEN_SECRET ?? "MISSING"
      );
    });

    it("forged x-user-role header without valid JWT has no effect", async () => {
      // No cookie — request has no access_token
      // x-user-role header must not be used for authentication
      mockChain(null);

      const req = new NextRequest(
        "http://localhost:3000/api/v1/auth/login",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-role": "admin",
          },
          body: JSON.stringify({
            email: "ghost@nowhere.com",
            password: "bad",
          }),
        }
      );

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });
  });

  // ── 7. All roles authenticate ────────────────────────────────────────────────
  describe("role-based login", () => {
    it.each([
      ["admin",     "admin@edushield.org"],
      ["teacher",   "teacher@edushield.org"],
      ["parent",    "parent.stu-001@edushield.org"],
      ["student",   "stu-001@students.edushield.org"],
      ["counselor", "counselor@edushield.org"],
    ])(
      "authenticates role=%s and returns it in the response",
      async (role, email) => {
        mockChain(makeMockUser({ role, email }));

        const res = await loginHandler(
          makeRequest({ email, password: DEMO_PASSWORD })
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.user.role).toBe(role);
      }
    );
  });
});
