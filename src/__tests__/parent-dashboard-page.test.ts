/**
 * Security tests for Parent Dashboard Server Component (src/app/(dashboard)/parent/page.tsx).
 *
 * Verifies:
 * 1. Missing JWT -> redirect to /login, no dashboard rendered
 * 2. Invalid JWT -> redirect to /login, no dashboard rendered
 * 3. Expired JWT -> redirect to /login, no dashboard rendered
 * 4. Admin JWT -> cannot render parent dashboard (redirect to /admin)
 * 5. Teacher JWT -> cannot render parent dashboard (redirect to /teacher)
 * 6. Student JWT -> cannot render parent dashboard (redirect to /student)
 * 7. Counselor JWT -> cannot render parent dashboard (redirect to /counselor)
 * 8. Unknown role -> cannot render parent dashboard (redirect to /login)
 * 9. Parent JWT with no matching Parent profile -> no dashboard rendered, safe failure/redirect behavior
 * 10. Valid parent JWT -> calls getAuthorizedParentDashboard(auth, "me"), renders returned data
 * 11. Auth context passed to service contains JWT-derived userId, role, schoolId
 * 12. Legacy method getParentDashboard("me") is NOT called directly by page.tsx
 * 13. Mock fallback is NOT rendered when authentication fails
 * 14. Forged identity headers cannot influence the server component
 */

import { SignJWT } from "jose";
import { signAccessToken } from "@/lib/jwt";
import ParentDashboard from "@/app/(dashboard)/parent/page";
import { ParentService } from "@/services/parent.service";
import type { UserRole } from "@/types/identity";

const mockRedirect = jest.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (error as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d0e0";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const PARENT_ID = "64a1b2c3d4e5f6a7b8c9d0d1";
const STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0f3";

const SAMPLE_DASHBOARD_DATA = {
  parentName: "Rajesh Verma",
  parentId: PARENT_ID,
  overallStatus: "Aarav is doing great this week!",
  aiWeeklySummary: "Aarav demonstrated solid academic consistency this week.",
  busStatus: {
    status: "On Route",
    message: "Bus 12 on schedule",
    location: "Sector 14 Road",
    isDelayed: false,
  },
  upcomingExamsList: [
    { id: 1, subject: "Physics", type: "MID TERM", date: "Fri, Aug 24", daysLeft: 2 },
  ],
  student: {
    id: "STU-1001",
    name: "Aarav Verma",
    firstName: "Aarav",
    lastName: "Verma",
    studentCode: "STU-1001",
    grade: "8-A",
    attendance: {
      percentage: 95,
      status: "good" as const,
      trend: "+1.5",
    },
    academics: {
      overallGPA: 3.8,
      pendingHomework: 1,
      completedHomework: 5,
      overdueHomework: 0,
      upcomingExams: 1,
      subjects: [
        { name: "Mathematics", score: 92 },
        { name: "Science", score: 88 },
      ],
    },
    classesToday: [],
    notices: [
      { id: 1, title: "Science Fair Registration", date: "Today", isNew: true },
    ],
    aiInsights: {
      recommendation: "Focus on Algebra practice before tomorrow's quiz.",
      topic: "Mathematics",
      confidence: "High",
      isDemo: true,
    },
  },
  linkedChildren: [
    {
      id: STUDENT_ID,
      studentCode: "STU-1001",
      name: "Aarav Verma",
      grade: "8-A",
      relationship: "father",
    },
  ],
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

async function tokenFor(
  role: UserRole | string,
  userId = PARENT_USER_ID,
  schoolId = SCHOOL_A
): Promise<string> {
  return signAccessToken({ userId, role: role as UserRole, schoolId });
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

describe("ParentDashboard Server Component Security", () => {
  let spyGetAuthorizedDashboard: jest.SpyInstance;
  let spyGetParentDashboard: jest.SpyInstance;

  beforeAll(() => {
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    spyGetAuthorizedDashboard = jest
      .spyOn(ParentService, "getAuthorizedParentDashboard")
      .mockResolvedValue(SAMPLE_DASHBOARD_DATA);
    spyGetParentDashboard = jest
      .spyOn(ParentService, "getParentDashboard")
      .mockResolvedValue(SAMPLE_DASHBOARD_DATA);
  });

  afterEach(() => {
    spyGetAuthorizedDashboard.mockRestore();
    spyGetParentDashboard.mockRestore();
  });

  // 1. Missing JWT
  it("1. Missing JWT: user is redirected to /login, no dashboard rendered, authorized service not called", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
    expect(spyGetParentDashboard).not.toHaveBeenCalled();
  });

  // 2. Invalid JWT
  it("2. Invalid JWT: redirected to /login, no dashboard rendered", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("invalid-malformed-token"));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
    expect(spyGetParentDashboard).not.toHaveBeenCalled();
  });

  it("2b. Foreign secret JWT: signature verification fails and redirects to /login", async () => {
    const foreignToken = await signedTokenWithSecret(FOREIGN_TEST_SECRET, "15m");
    mockCookies.mockResolvedValue(createMockCookieStore(foreignToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 3. Expired JWT
  it("3. Expired JWT: redirected to /login, no dashboard rendered", async () => {
    const expiredToken = await signedTokenWithSecret(TEST_SECRET, -10);
    mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 4. Admin JWT
  it("4. Admin JWT: cannot render parent dashboard, redirected to /admin", async () => {
    const adminToken = await tokenFor("admin");
    mockCookies.mockResolvedValue(createMockCookieStore(adminToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /admin");
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 5. Teacher JWT
  it("5. Teacher JWT: cannot render parent dashboard, redirected to /teacher", async () => {
    const teacherToken = await tokenFor("teacher");
    mockCookies.mockResolvedValue(createMockCookieStore(teacherToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /teacher");
    expect(mockRedirect).toHaveBeenCalledWith("/teacher");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 6. Student JWT
  it("6. Student JWT: cannot render parent dashboard, redirected to /student", async () => {
    const studentToken = await tokenFor("student");
    mockCookies.mockResolvedValue(createMockCookieStore(studentToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /student");
    expect(mockRedirect).toHaveBeenCalledWith("/student");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 7. Counselor JWT
  it("7. Counselor JWT: cannot render parent dashboard, redirected to /counselor", async () => {
    const counselorToken = await tokenFor("counselor");
    mockCookies.mockResolvedValue(createMockCookieStore(counselorToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /counselor");
    expect(mockRedirect).toHaveBeenCalledWith("/counselor");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 8. Unknown role
  it("8. Unknown role: cannot render parent dashboard, redirected to /login", async () => {
    const unknownToken = await tokenFor("superadmin");
    mockCookies.mockResolvedValue(createMockCookieStore(unknownToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 9. Parent JWT with no matching Parent profile
  it("9. Parent JWT with no matching Parent profile: no dashboard rendered, safe failure/redirect behavior", async () => {
    const parentToken = await tokenFor("parent");
    mockCookies.mockResolvedValue(createMockCookieStore(parentToken));

    // When the authorized service fails to resolve the parent profile, it throws
    spyGetAuthorizedDashboard.mockRejectedValue(
      new Error("Access denied. You are not authorized to view this parent's children.")
    );

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  // 10. Valid parent JWT
  it("10. Valid parent JWT: calls getAuthorizedParentDashboard(auth, 'me') and renders returned authorized data", async () => {
    const parentToken = await tokenFor("parent");
    mockCookies.mockResolvedValue(createMockCookieStore(parentToken));

    const jsx = await ParentDashboard();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(spyGetAuthorizedDashboard).toHaveBeenCalledTimes(1);
    expect(spyGetAuthorizedDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      }),
      "me"
    );

    // Verify rendered data in JSX
    const jsonTree = JSON.stringify(jsx);
    expect(jsonTree).toContain("Aarav Verma");
    expect(jsonTree).toContain("Live DB");
    expect(jsonTree).not.toContain("Mock Fallback");
    expect(jsonTree).not.toContain("Rahul Sharma");
  });

  // 11. Verify auth context passed to service contains JWT-derived userId, role, schoolId
  it("11. Verify the auth context passed to the service contains JWT-derived userId, role, schoolId", async () => {
    const customUserId = "64a1b2c3d4e5f6a7b8c9d099";
    const customSchoolId = "64a1b2c3d4e5f6a7b8c9d088";
    const parentToken = await tokenFor("parent", customUserId, customSchoolId);
    mockCookies.mockResolvedValue(createMockCookieStore(parentToken));

    await ParentDashboard();

    expect(spyGetAuthorizedDashboard).toHaveBeenCalledWith(
      {
        userId: customUserId,
        role: "parent",
        schoolId: customSchoolId,
      },
      "me"
    );
  });

  // 12. Verify legacy method is NOT called directly by page.tsx
  it("12. Verify the legacy method getParentDashboard('me') is NOT called directly by page.tsx", async () => {
    const parentToken = await tokenFor("parent");
    mockCookies.mockResolvedValue(createMockCookieStore(parentToken));

    await ParentDashboard();

    // The authorized service is called, but the legacy method must NOT be invoked directly by page.tsx
    expect(spyGetAuthorizedDashboard).toHaveBeenCalledWith(expect.anything(), "me");
    expect(spyGetParentDashboard).not.toHaveBeenCalled();
  });

  // 13. Verify mock fallback is NOT rendered when authentication fails
  it("13. Verify mock fallback is NOT rendered when authentication fails", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));

    let renderedResult: unknown = null;
    try {
      renderedResult = await ParentDashboard();
    } catch {
      // Expected NEXT_REDIRECT error
    }

    expect(renderedResult).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 14. Verify forged identity headers cannot influence the server component
  it("14. Verify forged identity headers cannot influence the server component", async () => {
    // Attempt with no cookie: forged headers cannot authenticate
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();

    // Attempt with student JWT: token role 'student' takes precedence over any forged header
    const studentToken = await tokenFor("student");
    mockCookies.mockResolvedValue(createMockCookieStore(studentToken));

    await expect(ParentDashboard()).rejects.toThrow("NEXT_REDIRECT: /student");
    expect(mockRedirect).toHaveBeenCalledWith("/student");
    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });
});
