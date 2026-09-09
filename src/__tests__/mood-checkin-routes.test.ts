/**
 * Security tests for GET /api/v1/mood-checkins/my
 *
 * Phase 2I HIGH-1: Mood Check-in Security
 *
 * Verifies:
 * - AUTHENTICATION: missing, malformed, expired, foreign-secret JWT -> 401
 * - STUDENT AUTHZ: student retrieves own mood data; studentId query param cannot override identity; cross-school access blocked -> 200 / 403
 * - PARENT AUTHZ: parent can access only linked child in same school; unlinked child or cross-school child -> 403
 * - OTHER ROLES: teacher, counselor, admin, unknown role fail closed -> 403
 * - SECURITY BEHAVIOR: header spoofing ignored; query gating (no DB checkin query on authz failure)
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { signAccessToken } from "@/lib/jwt";
import { GET as getMyMoodCheckins } from "@/app/api/v1/mood-checkins/my/route";
import { Student, MoodCheckin, Parent, ParentStudentRelationship } from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Student: { findOne: jest.fn() },
  MoodCheckin: { find: jest.fn(), countDocuments: jest.fn() },
  Parent: { findOne: jest.fn() },
  ParentStudentRelationship: { findOne: jest.fn(), find: jest.fn() },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MStudent = Student as unknown as { findOne: jest.Mock };
const MMoodCheckin = MoodCheckin as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MParent = Parent as unknown as { findOne: jest.Mock };
const MRelationship = ParentStudentRelationship as unknown as {
  findOne: jest.Mock;
  find: jest.Mock;
};

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d0e0";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d0e1";

const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0d1";

const OTHER_STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e4";
const OTHER_STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0d2";

const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e3";
const PARENT_ID = "64a1b2c3d4e5f6a7b8c9d0d3";

const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e5";
const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e6";
const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e7";

const STUDENT_DOC = {
  _id: STUDENT_ID,
  userId: STUDENT_USER_ID,
  schoolId: SCHOOL_A,
  studentCode: "STU-001",
  firstName: "Aarav",
  lastName: "Verma",
  isActive: true,
};

const OTHER_STUDENT_DOC = {
  _id: OTHER_STUDENT_ID,
  userId: OTHER_STUDENT_USER_ID,
  schoolId: SCHOOL_A,
  studentCode: "STU-002",
  firstName: "Diya",
  lastName: "Sharma",
  isActive: true,
};

const PARENT_DOC = {
  _id: PARENT_ID,
  userId: PARENT_USER_ID,
  schoolId: SCHOOL_A,
  firstName: "Rajesh",
  lastName: "Verma",
  isActive: true,
};

const RELATIONSHIP_DOC = {
  _id: "64a1b2c3d4e5f6a7b8c9d0r1",
  parentId: PARENT_ID,
  studentId: STUDENT_ID,
  schoolId: SCHOOL_A,
  relationship: "father",
};

const SAMPLE_MOOD_CHECKINS = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0m1",
    studentId: STUDENT_ID,
    schoolId: SCHOOL_A,
    date: new Date("2026-09-08"),
    moodScore: 4,
    moodLabel: "good",
    isAnonymous: false,
    createdAt: new Date("2026-09-08"),
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0m2",
    studentId: STUDENT_ID,
    schoolId: SCHOOL_A,
    date: new Date("2026-09-07"),
    moodScore: 5,
    moodLabel: "great",
    isAnonymous: false,
    createdAt: new Date("2026-09-07"),
  },
];

interface MoodCheckinFindChain {
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
}

let moodFindChain: MoodCheckinFindChain;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (value: unknown): any => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  lean: jest.fn().mockResolvedValue(value),
});

function moodList(value: unknown[]): MoodCheckinFindChain {
  const chain: MoodCheckinFindChain = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    select: jest.fn(),
    lean: jest.fn().mockResolvedValue(value),
  };

  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
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
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost:3000/api/v1/mood-checkins/my");
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url, { method: "GET", headers });
}

async function callRoute(
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
) {
  const response = await getMyMoodCheckins(createRequest(queryParams, headers));
  return { response, body: await response.json() };
}

async function tokenFor(
  role: UserRole | string,
  userId = STUDENT_USER_ID,
  schoolId = SCHOOL_A
): Promise<string> {
  return signAccessToken({ userId, role: role as UserRole, schoolId });
}

async function signedTokenWithSecret(
  secret: string,
  expiration: string | number
): Promise<string> {
  return new SignJWT({
    userId: STUDENT_USER_ID,
    role: "student",
    schoolId: SCHOOL_A,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

function setupDefaultMocks(): void {
  MStudent.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null);
    if (filter.userId === STUDENT_USER_ID && filter.schoolId === SCHOOL_A && filter.isActive === true) {
      return one(STUDENT_DOC);
    }
    if (filter.userId === OTHER_STUDENT_USER_ID && filter.schoolId === SCHOOL_A && filter.isActive === true) {
      return one(OTHER_STUDENT_DOC);
    }
    if (filter._id === STUDENT_ID && filter.schoolId === SCHOOL_A && filter.isActive === true) {
      return one(STUDENT_DOC);
    }
    if (filter._id === OTHER_STUDENT_ID && filter.schoolId === SCHOOL_A && filter.isActive === true) {
      return one(OTHER_STUDENT_DOC);
    }
    return one(null);
  });

  MParent.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null);
    if (filter.userId === PARENT_USER_ID && filter.schoolId === SCHOOL_A) {
      return one(PARENT_DOC);
    }
    return one(null);
  });

  MRelationship.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null);
    if (
      filter.parentId === PARENT_ID &&
      filter.studentId === STUDENT_ID &&
      filter.schoolId === SCHOOL_A
    ) {
      return one(RELATIONSHIP_DOC);
    }
    return one(null);
  });

  moodFindChain = moodList(SAMPLE_MOOD_CHECKINS);
  MMoodCheckin.find.mockReturnValue(moodFindChain);
  MMoodCheckin.countDocuments.mockResolvedValue(SAMPLE_MOOD_CHECKINS.length);
}

function expectNoMoodQueries(): void {
  expect(MMoodCheckin.find).not.toHaveBeenCalled();
  expect(MMoodCheckin.countDocuments).not.toHaveBeenCalled();
}

describe("GET /api/v1/mood-checkins/my - Security Tests", () => {
  beforeAll(() => {
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // A. Authentication
  describe("A. Authentication", () => {
    it("1. Missing JWT returns 401 and does not execute queries", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));
      const { response, body } = await callRoute();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expectNoMoodQueries();
    });

    it("2. Malformed JWT returns 401 and does not execute queries", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("not-a-valid-jwt"));
      const { response, body } = await callRoute();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expectNoMoodQueries();
    });

    it("3. Expired JWT returns 401 and does not execute queries", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await signedTokenWithSecret(TEST_SECRET, -10))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expectNoMoodQueries();
    });

    it("4. Foreign-secret signed JWT returns 401 and does not execute queries", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await signedTokenWithSecret(FOREIGN_TEST_SECRET, "15m"))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expectNoMoodQueries();
    });
  });

  // B. Student Authorization
  describe("B. Student Authorization", () => {
    it("5. Student can retrieve their own mood check-ins", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
      const { response, body } = await callRoute();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(MMoodCheckin.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
      expect(MMoodCheckin.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("6. Student cannot retrieve another student's mood check-ins (query studentId is ignored for student)", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
      const { response } = await callRoute({ studentId: OTHER_STUDENT_ID });

      expect(response.status).toBe(200);
      // Must query the authenticated student's own ID, NOT the other student's ID
      expect(MMoodCheckin.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
      expect(MMoodCheckin.find).not.toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: OTHER_STUDENT_ID,
        })
      );
    });

    it("7. studentId query parameter cannot override JWT identity", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
      await callRoute({ studentId: OTHER_STUDENT_ID });

      expect(MMoodCheckin.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
        })
      );
    });

    it("8. Student from School A cannot retrieve School B mood data (no student profile in school -> 403)", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("student", STUDENT_USER_ID, SCHOOL_B))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });
  });

  // C. Parent Authorization
  describe("C. Parent Authorization", () => {
    it("9. Authorized parent can access linked child's mood check-ins", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("parent", PARENT_USER_ID, SCHOOL_A))
      );
      const { response, body } = await callRoute({ studentId: STUDENT_ID });

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MMoodCheckin.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("10. Parent cannot access an unlinked student (returns 403)", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("parent", PARENT_USER_ID, SCHOOL_A))
      );
      const { response, body } = await callRoute({ studentId: OTHER_STUDENT_ID });

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });

    it("11. Parent cannot cross school boundaries (returns 403)", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("parent", PARENT_USER_ID, SCHOOL_B))
      );
      const { response, body } = await callRoute({ studentId: STUDENT_ID });

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });
  });

  // D. Other Roles (Fail Closed)
  describe("D. Other Roles (Fail Closed)", () => {
    it("12. Teacher is denied with 403", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("teacher", TEACHER_USER_ID, SCHOOL_A))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });

    it("13. Counselor is denied with 403 on individual personal check-in route", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("counselor", COUNSELOR_USER_ID, SCHOOL_A))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });

    it("14. Admin is denied with 403", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });

    it("15. Unknown role is denied with 403", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("superadmin", "64a1b2c3d4e5f6a7b8c9d0e9", SCHOOL_A))
      );
      const { response, body } = await callRoute();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      expectNoMoodQueries();
    });
  });

  // E. Security Behavior
  describe("E. Security Behavior", () => {
    it("16. Forged x-user-id header cannot change the target student", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
      await callRoute(undefined, { "x-user-id": OTHER_STUDENT_USER_ID });

      expect(MMoodCheckin.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
        })
      );
      expect(MMoodCheckin.find).not.toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: OTHER_STUDENT_ID,
        })
      );
    });

    it("17. Forged x-user-role header cannot elevate privileges", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("teacher")));
      const { response } = await callRoute(undefined, { "x-user-role": "student" });

      expect(response.status).toBe(403);
      expectNoMoodQueries();
    });

    it("18. Database mood-checkin query does not execute before authorization succeeds", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));
      await callRoute();
      expectNoMoodQueries();

      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
      await callRoute();
      expectNoMoodQueries();
    });

    it("19. No arbitrary studentId can be used to bypass authorization", async () => {
      mockCookies.mockResolvedValue(
        createMockCookieStore(await tokenFor("parent", PARENT_USER_ID, SCHOOL_A))
      );
      const { response } = await callRoute({ studentId: "64a1b2c3d4e5f6a7b8c9d099" });

      expect(response.status).toBe(403);
      expectNoMoodQueries();
    });

    it("20. Private notes are excluded from mood checkin query via select('-notes')", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
      await callRoute();

      expect(moodFindChain.select).toHaveBeenCalledWith("-notes");
    });
  });
});
