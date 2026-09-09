/**
 * Tests for JWT-protected GET /api/v1/parents/[parentId]/dashboard.
 * The real ParentService authorization logic runs with model queries mocked.
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { signAccessToken } from "@/lib/jwt";
import { GET as getDashboard } from "@/app/api/v1/parents/[parentId]/dashboard/route";
import { Parent, ParentStudentRelationship, Student, Admin, Exam, Bus } from "@/models";
import { StudentService } from "@/services/student.service";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Parent: { findOne: jest.fn() },
  ParentStudentRelationship: { find: jest.fn() },
  Student: { find: jest.fn() },
  Admin: { findOne: jest.fn() },
  Exam: { find: jest.fn() },
  Bus: { findOne: jest.fn() },
}));

jest.mock("@/services/student.service", () => ({
  StudentService: { getStudentSummary: jest.fn() },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MParent = Parent as unknown as { findOne: jest.Mock };
const MRelationship = ParentStudentRelationship as unknown as { find: jest.Mock };
const MStudent = Student as unknown as { find: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };
const MExam = Exam as unknown as { find: jest.Mock };
const MBus = Bus as unknown as { findOne: jest.Mock };
const MStudentService = StudentService as unknown as {
  getStudentSummary: jest.Mock;
};

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d0e0";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const PARENT_ID = "64a1b2c3d4e5f6a7b8c9d0d1";
const OTHER_PARENT_ID = "64a1b2c3d4e5f6a7b8c9d0d2";
const FOREIGN_PARENT_ID = "64a1b2c3d4e5f6a7b8c9d0d3";
const STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0f3";
const OTHER_STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0f4";
const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e5";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9d0d4";

const PARENT = {
  _id: PARENT_ID,
  userId: PARENT_USER_ID,
  schoolId: SCHOOL_A,
  firstName: "Rajesh",
  lastName: "Verma",
};

const OTHER_PARENT = {
  _id: OTHER_PARENT_ID,
  schoolId: SCHOOL_A,
  firstName: "Sana",
  lastName: "Khan",
};

const CHILD = {
  _id: STUDENT_ID,
  schoolId: SCHOOL_A,
  studentCode: "STU-1001",
  firstName: "Aarav",
  lastName: "Verma",
  grade: "8",
  section: "A",
  classId: "64a1b2c3d4e5f6a7b8c9d0f5",
  isActive: true,
};

const RELATIONSHIP = {
  parentId: PARENT_ID,
  studentId: STUDENT_ID,
  schoolId: SCHOOL_A,
  relationship: "father",
  isPrimary: true,
  canReceiveAlerts: true,
  canReceiveReports: true,
};

const STUDENT_SUMMARY = {
  attendance: { percentage: 93, status: "good", trend: "+1.0" },
  academics: {
    overallGPA: 3.8,
    pendingHomework: 1,
    completedHomework: 4,
    overdueHomework: 0,
    upcomingExams: 1,
    subjects: [],
  },
  classesToday: [],
  notices: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (value: unknown): any => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  lean: jest.fn().mockResolvedValue(value),
});

const many = (value: unknown[]) => ({ lean: jest.fn().mockResolvedValue(value) });

const examMany = (value: unknown[]) => {
  const chain = {
    sort: jest.fn(),
    limit: jest.fn(),
    populate: jest.fn(),
    lean: jest.fn().mockResolvedValue(value),
  };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  return chain;
};

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

function createParams(parentId: string) {
  return { params: Promise.resolve({ parentId }) };
}

function createRequest(
  studentId?: string,
  headers?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost:3000/api/v1/parents/dashboard");
  if (studentId) url.searchParams.set("studentId", studentId);
  return new NextRequest(url, { method: "GET", headers });
}

async function callRoute(
  parentId: string,
  studentId?: string,
  headers?: Record<string, string>
) {
  const response = await getDashboard(createRequest(studentId, headers), createParams(parentId));
  return { response, body: await response.json() };
}

async function tokenFor(
  role: UserRole,
  userId = PARENT_USER_ID,
  schoolId = SCHOOL_A
): Promise<string> {
  return signAccessToken({ userId, role, schoolId });
}

async function signedTokenWithSecret(
  secret: string,
  expiration: string | number
): Promise<string> {
  return new SignJWT({
    userId: PARENT_USER_ID,
    role: "parent",
    schoolId: SCHOOL_A,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

function setupDashboardFlow(): void {
  MParent.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null);
    if ("userId" in filter) return one(PARENT);
    if (filter._id === FOREIGN_PARENT_ID) return one(null);
    if (filter._id === OTHER_PARENT_ID) return one(OTHER_PARENT);
    return one(PARENT);
  });
  MRelationship.find.mockReturnValue(many([RELATIONSHIP]));
  MStudent.find.mockReturnValue(many([CHILD]));
  MAdmin.findOne.mockReturnValue(one({ _id: ADMIN_ID }));
  MStudentService.getStudentSummary.mockResolvedValue(STUDENT_SUMMARY);
  MExam.find.mockReturnValue(examMany([]));
  MBus.findOne.mockReturnValue(one(null));
}

function expectNoSensitiveDashboardQueries(): void {
  expect(MStudentService.getStudentSummary).not.toHaveBeenCalled();
  expect(MExam.find).not.toHaveBeenCalled();
  expect(MBus.findOne).not.toHaveBeenCalled();
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
  it("returns 401 when the JWT is missing", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoSensitiveDashboardQueries();
  });

  it("returns 401 when the JWT is malformed", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("not-a-jwt"));
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoSensitiveDashboardQueries();
  });

  it("returns 401 when the JWT is expired", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(TEST_SECRET, -1))
    );
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoSensitiveDashboardQueries();
  });

  it("returns 401 when the JWT signature is invalid", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(FOREIGN_TEST_SECRET, "15m"))
    );
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoSensitiveDashboardQueries();
  });
});

describe("parent authorization", () => {
  it("allows a parent to access their own explicit dashboard", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(200);
    expect(body.data.parentId).toBe(PARENT_ID);
    expect(MParent.findOne).toHaveBeenCalledWith({ userId: PARENT_USER_ID, schoolId: SCHOOL_A });
  });

  it("allows a parent to use 'me' without the first-parent fallback", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute("me");

    expect(response.status).toBe(200);
    expect(body.data.parentId).toBe(PARENT_ID);
    expect(MParent.findOne.mock.calls.some(([filter]) => filter === undefined)).toBe(false);
  });

  it("denies another same-school parent's dashboard", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(OTHER_PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("denies a foreign-school parent's dashboard", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(FOREIGN_PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("denies another parent's studentId without reaching sensitive queries", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(PARENT_ID, OTHER_STUDENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("allows a parent to select their own active linked child", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(PARENT_ID, STUDENT_ID);

    expect(response.status).toBe(200);
    expect(body.data.student.attendance.percentage).toBe(93);
    expect(MStudentService.getStudentSummary).toHaveBeenCalledWith(STUDENT_ID);
  });
});

describe("admin authorization", () => {
  it("allows an active same-school admin to access an explicit parent", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(200);
    expect(body.data.parentId).toBe(PARENT_ID);
    expect(MAdmin.findOne).toHaveBeenCalledWith({
      userId: ADMIN_USER_ID,
      schoolId: SCHOOL_A,
      isActive: true,
    });
    expect(MParent.findOne).toHaveBeenCalledWith({ _id: PARENT_ID, schoolId: SCHOOL_A });
  });

  it("denies 'me' for an admin", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute("me");

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("denies a foreign-school parent to an admin", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute(FOREIGN_PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("denies an inactive admin", async () => {
    setupDashboardFlow();
    MAdmin.findOne.mockReturnValue(one(null));
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("denies an admin with no profile", async () => {
    setupDashboardFlow();
    MAdmin.findOne.mockReturnValue(one(null));
    mockCookies.mockResolvedValue(
      createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A))
    );
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });
});

describe("other roles and forged headers", () => {
  it.each(["student", "teacher", "counselor"] as const)(
    "denies the %s role",
    async (role) => {
      setupDashboardFlow();
      mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor(role)));
      const { response, body } = await callRoute(PARENT_ID);

      expect(response.status).toBe(403);
      expect(body.data).toBeUndefined();
      expectNoSensitiveDashboardQueries();
    }
  );

  it("denies an unknown role", async () => {
    setupDashboardFlow();
    const token = await signAccessToken({
      userId: PARENT_USER_ID,
      role: "unknown" as UserRole,
      schoolId: SCHOOL_A,
    });
    mockCookies.mockResolvedValue(createMockCookieStore(token));
    const { response, body } = await callRoute(PARENT_ID);

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });

  it("does not treat a forged x-user-id as authentication", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response, body } = await callRoute(PARENT_ID, undefined, {
      "x-user-id": PARENT_USER_ID,
    });

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoSensitiveDashboardQueries();
  });

  it("does not let a forged x-user-role override a parent JWT", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute(OTHER_PARENT_ID, undefined, {
      "x-user-role": "admin",
    });

    expect(response.status).toBe(403);
    expect(body.data).toBeUndefined();
    expectNoSensitiveDashboardQueries();
  });
});

describe("authorization-query safety", () => {
  it("never uses a filterless Parent.findOne during an authorized dashboard request", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response } = await callRoute(PARENT_ID);

    expect(response.status).toBe(200);
    expect(MParent.findOne.mock.calls.some(([filter]) => filter === undefined)).toBe(false);
  });

  it("keeps linked-child queries scoped to the JWT-derived parent and school", async () => {
    setupDashboardFlow();
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    await callRoute(PARENT_ID);

    expect(MRelationship.find).toHaveBeenCalledWith({ parentId: PARENT_ID, schoolId: SCHOOL_A });
    expect(MStudent.find).toHaveBeenCalledWith({
      _id: { $in: [STUDENT_ID] },
      schoolId: SCHOOL_A,
      isActive: true,
    });
  });
});
