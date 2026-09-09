/**
 * Tests for JWT-protected GET /api/v1/parents
 *
 * STEP 2G — SECURE GET /api/v1/parents
 *
 * Verifies:
 * - AUTHENTICATION: missing, malformed, expired, or invalid signature tokens return 401
 * - ROLE AUTHORIZATION: parent, student, teacher, counselor, unknown roles return 403
 * - ADMIN: active same-school admin succeeds; missing or inactive Admin profile returns 403
 * - TENANT ISOLATION: find and countDocuments are strictly scoped to auth.schoolId; foreign parents never appear
 * - HEADER SPOOFING: x-user-id and x-user-role headers cannot authenticate or elevate permissions
 * - QUERY GATING: sensitive Parent queries never run when authentication or authorization fails
 * - PAGINATION: preserves page and pageSize pagination controls and bounding
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { signAccessToken } from "@/lib/jwt";
import { GET as getParentDirectory } from "@/app/api/v1/parents/route";
import { Parent, Admin } from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Parent: { find: jest.fn(), countDocuments: jest.fn() },
  Admin: { findOne: jest.fn() },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MParent = Parent as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d0e0";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d0e1";
const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9d0d1";

const SCHOOL_A_PARENTS = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0f1",
    userId: "64a1b2c3d4e5f6a7b8c9d0f2",
    schoolId: SCHOOL_A,
    firstName: "Rajesh",
    lastName: "Verma",
    phone: "+91-9000000001",
    occupation: "Engineer",
    preferredLanguage: "en",
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0f3",
    userId: "64a1b2c3d4e5f6a7b8c9d0f4",
    schoolId: SCHOOL_A,
    firstName: "Sana",
    lastName: "Khan",
    phone: "+91-9000000002",
    occupation: "Doctor",
    preferredLanguage: "en",
  },
];

interface ParentFindChain {
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  lean: jest.Mock;
}

let parentFindChain: ParentFindChain;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (value: unknown): any => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  lean: jest.fn().mockResolvedValue(value),
});

function parentList(value: unknown[]): ParentFindChain {
  const chain: ParentFindChain = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn().mockResolvedValue(value),
  };
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

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

function createRequest(
  query: Record<string, string> = {},
  headers?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost:3000/api/v1/parents");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: "GET", headers });
}

async function callRoute(
  query: Record<string, string> = {},
  headers?: Record<string, string>
) {
  const response = await getParentDirectory(createRequest(query, headers));
  return { response, body: await response.json() };
}

async function tokenFor(
  role: UserRole,
  userId = ADMIN_USER_ID,
  schoolId = SCHOOL_A
): Promise<string> {
  return signAccessToken({ userId, role, schoolId });
}

async function signedTokenWithSecret(
  secret: string,
  expiration: string | number
): Promise<string> {
  return new SignJWT({
    userId: ADMIN_USER_ID,
    role: "admin",
    schoolId: SCHOOL_A,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

function setupDirectoryFlow(): void {
  MAdmin.findOne.mockReturnValue(one({ _id: ADMIN_ID }));
  parentFindChain = parentList(SCHOOL_A_PARENTS);
  MParent.find.mockReturnValue(parentFindChain);
  MParent.countDocuments.mockResolvedValue(SCHOOL_A_PARENTS.length);
}

function expectNoParentDirectoryQueries(): void {
  expect(MParent.find).not.toHaveBeenCalled();
  expect(MParent.countDocuments).not.toHaveBeenCalled();
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

describe("AUTHENTICATION", () => {
  it("1. Missing JWT -> 401", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();
  });

  it("2. Malformed JWT -> 401", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("not-a-jwt"));
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();
  });

  it("3. Expired JWT -> 401", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(TEST_SECRET, -1))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();
  });

  it("4. Invalid signature -> 401", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(FOREIGN_TEST_SECRET, "15m"))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();
  });
});

describe("ROLE AUTHORIZATION", () => {
  it("5. Parent -> 403", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    expectNoParentDirectoryQueries();
  });

  it("6. Student -> 403", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    expectNoParentDirectoryQueries();
  });

  it("7. Teacher -> 403", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("teacher")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    expectNoParentDirectoryQueries();
  });

  it("8. Counselor -> 403", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("counselor")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    expectNoParentDirectoryQueries();
  });

  it("9. Unknown role -> 403", async () => {
    const token = await signAccessToken({
      userId: ADMIN_USER_ID,
      role: "unknown" as UserRole,
      schoolId: SCHOOL_A,
    });
    mockCookies.mockResolvedValue(createMockCookieStore(token));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    expectNoParentDirectoryQueries();
  });
});

describe("ADMIN", () => {
  it("10. Active same-school admin succeeds", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(SCHOOL_A_PARENTS);
    expect(MAdmin.findOne).toHaveBeenCalledWith({
      userId: ADMIN_USER_ID,
      schoolId: SCHOOL_A,
      isActive: true,
    });
    expect(MParent.find).toHaveBeenCalledWith({ schoolId: SCHOOL_A });
    expect(MParent.countDocuments).toHaveBeenCalledWith({ schoolId: SCHOOL_A });
  });

  it("11. Missing Admin profile -> 403", async () => {
    setupDirectoryFlow();
    MAdmin.findOne.mockReturnValue(one(null));
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoParentDirectoryQueries();
  });

  it("12. Inactive Admin profile -> 403", async () => {
    setupDirectoryFlow();
    // findOne queries with { isActive: true }, returning null if the admin profile is inactive
    MAdmin.findOne.mockReturnValue(one(null));
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(MAdmin.findOne).toHaveBeenCalledWith({
      userId: ADMIN_USER_ID,
      schoolId: SCHOOL_A,
      isActive: true,
    });
    expectNoParentDirectoryQueries();
  });
});

describe("TENANT ISOLATION", () => {
  it("13. Admin receives only parents from auth.schoolId", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.data.every((parent: { schoolId: string }) => parent.schoolId === SCHOOL_A)).toBe(true);
  });

  it("14. Foreign-school parents never appear", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(MParent.find).toHaveBeenCalledWith({ schoolId: SCHOOL_A });
    expect(body.data.some((parent: { schoolId: string }) => parent.schoolId === SCHOOL_B)).toBe(false);
  });

  it("15. Parent.countDocuments() uses auth.schoolId", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    await callRoute();

    expect(MParent.countDocuments).toHaveBeenCalledTimes(1);
    expect(MParent.countDocuments).toHaveBeenCalledWith({ schoolId: SCHOOL_A });
  });

  it("16. Parent.find() uses auth.schoolId", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    await callRoute();

    expect(MParent.find).toHaveBeenCalledTimes(1);
    expect(MParent.find).toHaveBeenCalledWith({ schoolId: SCHOOL_A });
  });
});

describe("HEADER SPOOFING", () => {
  it("17. x-user-id cannot impersonate admin", async () => {
    // Unauthenticated request with forged x-user-id header
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response: res1, body: body1 } = await callRoute({}, {
      "x-user-id": ADMIN_USER_ID,
    });
    expect(res1.status).toBe(401);
    expect(body1.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();

    // Authenticated non-admin request with forged x-user-id header pointing to admin
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
    const { response: res2, body: body2 } = await callRoute({}, {
      "x-user-id": ADMIN_USER_ID,
    });
    expect(res2.status).toBe(403);
    expect(body2.error.code).toBe("FORBIDDEN");
    expectNoParentDirectoryQueries();
  });

  it("18. x-user-role cannot elevate another role to admin", async () => {
    // Unauthenticated request with forged x-user-role header
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response: res1, body: body1 } = await callRoute({}, {
      "x-user-role": "admin",
    });
    expect(res1.status).toBe(401);
    expect(body1.error.code).toBe("UNAUTHORIZED");
    expectNoParentDirectoryQueries();

    // Authenticated parent JWT with forged x-user-role header claiming admin
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response: res2, body: body2 } = await callRoute({}, {
      "x-user-role": "admin",
    });
    expect(res2.status).toBe(403);
    expect(body2.error.code).toBe("FORBIDDEN");
    expectNoParentDirectoryQueries();
  });
});

describe("QUERY GATING", () => {
  it("19. Invalid JWT does not execute Parent.find()", async () => {
    // Missing JWT
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    await callRoute();
    expectNoParentDirectoryQueries();

    // Malformed JWT
    mockCookies.mockResolvedValue(createMockCookieStore("malformed.token.value"));
    await callRoute();
    expectNoParentDirectoryQueries();

    // Expired JWT
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(TEST_SECRET, -10))
    );
    await callRoute();
    expectNoParentDirectoryQueries();

    // Invalid signature JWT
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(FOREIGN_TEST_SECRET, "1h"))
    );
    await callRoute();
    expectNoParentDirectoryQueries();
  });

  it("20. Non-admin does not execute Parent.find()", async () => {
    for (const role of ["parent", "student", "teacher", "counselor"] as const) {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor(role)));
      await callRoute();
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expectNoParentDirectoryQueries();
    }
  });

  it("21. Missing/inactive Admin profile does not execute Parent.find()", async () => {
    setupDirectoryFlow();
    MAdmin.findOne.mockReturnValue(one(null));
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    await callRoute();

    expect(MAdmin.findOne).toHaveBeenCalledTimes(1);
    expectNoParentDirectoryQueries();
  });
});

describe("PAGINATION", () => {
  it("22. Existing pagination works", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute({ page: "2", pageSize: "10" });

    expect(response.status).toBe(200);
    expect(body.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: SCHOOL_A_PARENTS.length,
      totalPages: 1,
    });
    expect(parentFindChain.skip).toHaveBeenCalledWith(10);
    expect(parentFindChain.limit).toHaveBeenCalledWith(10);
  });

  it("23. Existing pageSize limit remains enforced", async () => {
    setupDirectoryFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute({ pageSize: "500" });

    expect(response.status).toBe(200);
    expect(body.meta.pageSize).toBe(100);
    expect(parentFindChain.limit).toHaveBeenCalledWith(100);
  });
});
