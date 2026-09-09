/**
 * Tests for JWT-protected GET /api/v1/parents/[parentId]/children
 * - No/invalid/expired JWT -> 401
 * - parent: own children only via auth.userId + auth.schoolId ("me" = own alias,
 *   the unsafe first-parent fallback is never invoked)
 * - admin: same-school target parents only ("me" rejected)
 * - student / teacher / counselor / unknown roles -> 403 (fail closed)
 * - Forged x-user-id / x-user-role cannot influence authorization
 * - URL parentId is a resource selector, never proof of ownership
 * - Children queries remain school-scoped; no data on denial
 */

import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { GET as getChildren } from "@/app/api/v1/parents/[parentId]/children/route";
import { Parent, ParentStudentRelationship, Student, Admin } from "@/models";
import type { UserRole } from "@/types/identity";

// Mock next/headers (used by requireAuth -> getAuthContext)
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Mock database connection
jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

// Mock models used by ParentService (real service logic runs)
jest.mock("@/models", () => ({
  Parent: { findOne: jest.fn(), find: jest.fn() },
  ParentStudentRelationship: { find: jest.fn() },
  Student: { find: jest.fn(), findOne: jest.fn() },
  Admin: { findOne: jest.fn() },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MParent = Parent as unknown as { findOne: jest.Mock };
const MRel = ParentStudentRelationship as unknown as { find: jest.Mock };
const MStudent = Student as unknown as { find: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";

const SA = "64a1b2c3d4e5f6a7b8c9d0e0"; // authenticated school (JWT)
const PU = "64a1b2c3d4e5f6a7b8c9d0e2"; // authenticated parent User _id
const PD = "64a1b2c3d4e5f6a7b8c9d0d1"; // authenticated parent _id
const OD = "64a1b2c3d4e5f6a7b8c9d0d2"; // another parent _id (same school)
const FB = "64a1b2c3d4e5f6a7b8c9d0d3"; // foreign-school parent _id
const SD = "64a1b2c3d4e5f6a7b8c9d0f3"; // linked child student _id
const AU = "64a1b2c3d4e5f6a7b8c9d0e5"; // admin User _id
const AD = "64a1b2c3d4e5f6a7b8c9d0d4"; // admin profile _id

const PARENT = {
  _id: PD,
  userId: PU,
  schoolId: SA,
  firstName: "Rajesh",
  lastName: "Verma",
};
const CHILD = {
  _id: SD,
  schoolId: SA,
  firstName: "Aarav",
  lastName: "Verma",
  isActive: true,
};
const REL = {
  studentId: SD,
  relationship: "father",
  isPrimary: true,
  canReceiveAlerts: true,
  canReceiveReports: true,
};

// chainable mock: supports .select("_id").lean() and direct .lean()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: unknown): any => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(v) }),
  lean: jest.fn().mockResolvedValue(v),
});
const many = (v: unknown[]) => ({ lean: jest.fn().mockResolvedValue(v) });

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

function createRequest(headers?: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/v1/parents/x", {
    method: "GET",
    headers,
  });
}

function createParams(parentId: string) {
  return { params: Promise.resolve({ parentId }) };
}

async function callRoute(parentId: string, headers?: Record<string, string>) {
  const res = await getChildren(createRequest(headers), createParams(parentId));
  const body = await res.json();
  return { res, body };
}

async function tokenFor(
  role: UserRole,
  userId = PU,
  schoolId = SA
): Promise<string> {
  return signAccessToken({ userId, role, schoolId });
}

/**
 * Mock the full parent->children data flow.
 * The unsafe first-parent fallback (Parent.findOne() with no filter) is wired
 * to return null so that any accidental use of it fails loudly instead of
 * silently succeeding.
 */
function setupParentFlow() {
  MParent.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null); // unsafe "me" fallback — must never be hit
    if ("userId" in filter) return one(PARENT); // resolveParentByUserId
    if (filter._id === FB) return one(null); // foreign-school parent invisible
    return one(PARENT); // resolveParent by _id / admin school-scoped target
  });
  MRel.find.mockReturnValue(many([REL]));
  MStudent.find.mockReturnValue(many([CHILD]));
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

describe("authentication", () => {
  it("returns 401 with no JWT", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with a malformed JWT", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("not-a-real-jwt"));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with an expired JWT", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(TEST_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({
      userId: PU,
      role: "parent",
      schoolId: SA,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 1)
      .sign(secret);

    mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("parent role", () => {
  it("returns own children for the authenticated parent", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.parentId).toBe(PD);
    expect(body.data.totalChildren).toBe(1);
    expect(body.data.children[0].firstName).toBe("Aarav");
  });

  it("treats 'me' as an alias for the authenticated parent (no first-parent fallback)", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute("me");
    expect(res.status).toBe(200);
    expect(body.data.parentId).toBe(PD);
    // The unsafe fallback (Parent.findOne() with no filter) must never run.
    const noFilterCall = MParent.findOne.mock.calls.find((c) => c.length === 0);
    expect(noFilterCall).toBeUndefined();
  });

  it("denies another parent's children (403, no data)", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute(OD);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    // Child data retrieval must never be reached.
    expect(MRel.find).not.toHaveBeenCalled();
    expect(MStudent.find).not.toHaveBeenCalled();
  });

  it("denies a foreign-school parent (403, no existence leak)", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute(FB);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    expect(MRel.find).not.toHaveBeenCalled();
    expect(MStudent.find).not.toHaveBeenCalled();
  });

  it("derives identity from auth.userId + auth.schoolId, never the URL", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    await callRoute(PD);
    // The authenticated parent must be resolved from the JWT claims…
    expect(MParent.findOne).toHaveBeenCalledWith({ userId: PU, schoolId: SA });
    // …and the children flow must use the JWT-derived parent _id.
    expect(MParent.findOne).toHaveBeenCalledWith({ _id: PD });
  });

  it("never invokes the unsafe first-parent fallback for a regular request", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    await callRoute(PD);
    const filterlessCall = MParent.findOne.mock.calls.find(
      (c) => c.length === 0 || c[0] === undefined
    );
    expect(filterlessCall).toBeUndefined();
  });
});

describe("admin role", () => {
  function setupAdminFlow() {
    MAdmin.findOne.mockReturnValue(one({ _id: AD }));
    MParent.findOne.mockImplementation((filter?: Record<string, unknown>) => {
      if (!filter) return one(null); // unsafe "me" fallback — must never be hit
      if ("userId" in filter) return one(PARENT);
      if (filter._id === FB) return one(null); // School B parent invisible to School A admin
      return one(PARENT);
    });
    MRel.find.mockReturnValue(many([REL]));
    MStudent.find.mockReturnValue(many([CHILD]));
  }

  it("returns a same-school parent's children", async () => {
    setupAdminFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", AU, SA))
    );
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(200);
    expect(body.data.parentId).toBe(PD);
    expect(body.data.totalChildren).toBe(1);
    // Admin profile and target parent must both be school-scoped lookups.
    expect(MAdmin.findOne).toHaveBeenCalledWith({
      userId: AU,
      schoolId: SA,
      isActive: true,
    });
    expect(MParent.findOne).toHaveBeenCalledWith({ _id: PD, schoolId: SA });
  });

  it("denies another-school parent's children (403, invisible)", async () => {
    setupAdminFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", AU, SA))
    );
    const { res, body } = await callRoute(FB);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    expect(MRel.find).not.toHaveBeenCalled();
  });

  it("rejects 'me' — admins have no implicit parent identity and no first-parent fallback", async () => {
    setupAdminFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", AU, SA))
    );
    const { res, body } = await callRoute("me");
    expect(res.status).toBe(403);
    expect(body.data).toBeUndefined();
    // Denied before any database access — never resolves to the first parent.
    expect(MAdmin.findOne).not.toHaveBeenCalled();
    const filterlessCall = MParent.findOne.mock.calls.find(
      (c) => c.length === 0 || c[0] === undefined
    );
    expect(filterlessCall).toBeUndefined();
  });
});

describe("other roles fail closed", () => {
  it.each([
    ["student" as const],
    ["teacher" as const],
    ["counselor" as const],
  ])("denies %s JWT (403, no data, no DB access)", async (role) => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor(role)));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    expect(MParent.findOne).not.toHaveBeenCalled();
    expect(MRel.find).not.toHaveBeenCalled();
    expect(MStudent.find).not.toHaveBeenCalled();
  });

  it("denies an unknown role (403)", async () => {
    setupParentFlow();
    const token = await signAccessToken({
      userId: PU,
      role: "unknown-role" as unknown as UserRole,
      schoolId: SA,
    });
    mockCookies.mockResolvedValue(createMockCookieStore(token));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    expect(MParent.findOne).not.toHaveBeenCalled();
  });
});

describe("forged headers cannot bypass authentication or authorization", () => {
  it("returns 401 for a forged x-user-id without a JWT", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { res, body } = await callRoute(PD, { "x-user-id": PU });
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(MParent.findOne).not.toHaveBeenCalled();
  });

  it("returns 401 for a forged x-user-role without a JWT", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { res, body } = await callRoute(PD, { "x-user-role": "parent" });
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(MParent.findOne).not.toHaveBeenCalled();
  });

  it("forged headers with a valid parent JWT cannot change which parent is authorized", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("parent"))
    );
    const { res, body } = await callRoute(OD, {
      "x-user-id": AU, // forged: claim to be the admin's user id
      "x-user-role": "admin", // forged: claim admin role
    });
    // Authorization still uses the JWT claims (parent, PU, SA): OD is not the
    // authenticated parent's id, so access is denied regardless of headers.
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.data).toBeUndefined();
    expect(MParent.findOne).toHaveBeenCalledWith({ userId: PU, schoolId: SA });
    expect(MRel.find).not.toHaveBeenCalled();
  });
});

describe("IDOR and data isolation", () => {
  it("URL parentId cannot override the authenticated parent identity", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res } = await callRoute(OD);
    expect(res.status).toBe(403);
    // The only parent identity lookup is the JWT-derived one ({userId, schoolId});
    // no lookup ever treated the URL id as the caller's identity.
    const identityLookups = MParent.findOne.mock.calls.filter(
      (c) => c[0] && typeof c[0] === "object" && "_id" in (c[0] as object)
    );
    expect(identityLookups).toEqual([]);
  });

  it("children queries remain strictly school-scoped", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    await callRoute(PD);
    expect(MRel.find).toHaveBeenCalledWith({ parentId: PD, schoolId: SA });
    expect(MStudent.find).toHaveBeenCalledWith({
      _id: { $in: [SD] },
      schoolId: SA,
      isActive: true,
    });
  });

  it("never returns cross-school child data", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute(PD);
    expect(res.status).toBe(200);
    // The relationship lookup is pinned to the authenticated school, and the
    // student fetch filters { schoolId: SA, isActive: true }, so a School B
    // child can never enter the result set.
    expect(MRel.find).toHaveBeenCalledWith({ parentId: PD, schoolId: SA });
    const studentQuery = MStudent.find.mock.calls[0][0] as Record<string, unknown>;
    expect(studentQuery.schoolId).toBe(SA);
    expect(body.data.children).toHaveLength(1);
    expect(body.data.children[0].schoolId).toBe(SA);
  });

  it("returns no children data when authorization fails", async () => {
    setupParentFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { res, body } = await callRoute(FB);
    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.data).toBeUndefined();
    expect(MStudent.find).not.toHaveBeenCalled();
  });
});


