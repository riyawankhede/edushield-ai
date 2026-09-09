/**
 * Security tests for GET /api/v1/counselors/[counselorId]/dashboard
 *
 * Phase 2J CRIT-2 Security Hardening:
 * - AUTHENTICATION: missing, malformed, expired, foreign-secret JWT returns 401
 * - COUNSELOR AUTHZ: counselor can access only their own dashboard ("me", "current", own _id, own staffCode)
 * - PEER ACCESS BLOCKED: counselor accessing another counselor in the same school returns 403
 * - CROSS-TENANT ACCESS BLOCKED: counselor accessing another school's counselor returns 403
 * - IDENTITY INTEGRITY: "me" resolves strictly to verified JWT identity, never global first-counselor
 * - FAIL CLOSED: student, parent, teacher, admin, and unknown roles return 403
 * - PROFILE VERIFICATION: missing or inactive counselor profile returns 403
 * - TENANT ISOLATION: all underlying queries are strictly scoped to auth.schoolId
 * - SPOOFING IMMUNITY: x-user-role and x-user-id headers are ignored
 * - QUERY GATING: no sensitive well-being / safety queries execute when authorization fails
 * - RESPONSE CONTRACT: verified dashboard response shape remains intact
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getCounselorDashboardRoute } from "@/app/api/v1/counselors/[counselorId]/dashboard/route";
import { Counselor, SafetyReport, AttendanceRecord, MoodCheckin, Student } from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Counselor: {
    findOne: jest.fn(),
  },
  SafetyReport: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  AttendanceRecord: {
    aggregate: jest.fn(),
  },
  MoodCheckin: {
    aggregate: jest.fn(),
  },
  Student: {
    find: jest.fn(),
  },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const MSafetyReport = SafetyReport as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MAttendanceRecord = AttendanceRecord as unknown as { aggregate: jest.Mock };
const MMoodCheckin = MoodCheckin as unknown as { aggregate: jest.Mock };
const MStudent = Student as unknown as { find: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const COUNSELOR_ID = "64a1b2c3d4e5f6a7b8c9dc01";
const COUNSELOR_STAFF_CODE = "CNS-001";

const OTHER_COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d011";
const OTHER_COUNSELOR_ID = "64a1b2c3d4e5f6a7b8c9dc02";
const OTHER_COUNSELOR_STAFF_CODE = "CNS-002";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";

const OWN_COUNSELOR_DOC = {
  _id: COUNSELOR_ID,
  userId: COUNSELOR_USER_ID,
  schoolId: SCHOOL_A,
  staffCode: COUNSELOR_STAFF_CODE,
  firstName: "Sunita",
  lastName: "Rao",
  isActive: true,
};

async function makeToken(
  payload: { userId: string; role: UserRole; schoolId: string },
  expiresIn = "15m",
  secret = TEST_SECRET
) {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

function setCookieToken(token?: string) {
  mockCookies.mockResolvedValue({
    get: jest.fn().mockImplementation((name: string) => {
      if (name === "access_token" && token) {
        return { name: "access_token", value: token };
      }
      return undefined;
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function mockSelectLean(returnValue: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(returnValue),
    }),
    lean: jest.fn().mockResolvedValue(returnValue),
  };
}

function setupSuccessfulDashboardMocks() {
  MCounselor.findOne.mockReturnValue(mockSelectLean(OWN_COUNSELOR_DOC));

  MSafetyReport.countDocuments.mockResolvedValue(10);
  const safetyLean = jest.fn().mockResolvedValue([
    {
      _id: "report_1",
      reportType: "bullying",
      locationDescription: "Library",
      status: "new",
      isAnonymous: true,
      nlpSignals: { severity: "high" },
      createdAt: new Date("2026-09-01"),
    },
  ]);
  const safetyLimit = jest.fn().mockReturnValue({ lean: safetyLean });
  const safetySort = jest.fn().mockReturnValue({ limit: safetyLimit });
  MSafetyReport.find.mockReturnValue({ sort: safetySort });

  MAttendanceRecord.aggregate.mockResolvedValue([
    { _id: "student_1", total: 20, present: 14, rate: 70 },
  ]);

  MMoodCheckin.aggregate.mockResolvedValue([
    { _id: "student_1", avgMood: 1.5, lowMoodCount: 3 },
  ]);

  const studentLean = jest.fn().mockResolvedValue([
    {
      _id: "student_1",
      firstName: "Rahul",
      lastName: "Sharma",
      studentCode: "STU-001",
      grade: "10",
      section: "A",
    },
  ]);
  const studentLimit = jest.fn().mockReturnValue({ lean: studentLean });
  const studentSelect = jest.fn().mockReturnValue({ limit: studentLimit });
  MStudent.find.mockReturnValue({ select: studentSelect });
}

describe("GET /api/v1/counselors/[counselorId]/dashboard - Security Tests", () => {
  beforeAll(() => {
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // A. AUTHENTICATION
  // ==========================================
  describe("A. Authentication", () => {
    it("1. Unauthenticated request returns 401", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MCounselor.findOne).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("malformed.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MCounselor.findOne).not.toHaveBeenCalled();
    });

    it("3. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: COUNSELOR_USER_ID, role: "counselor", schoolId: SCHOOL_A },
        "-1s"
      );
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });

    it("4. Foreign-secret JWT returns 401", async () => {
      const token = await makeToken(
        { userId: COUNSELOR_USER_ID, role: "counselor", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_TEST_SECRET
      );
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  // ==========================================
  // B. COUNSELOR AUTHORIZATION (OWN ACCESS ONLY)
  // ==========================================
  describe("B. Counselor Authorization (Own Access Only)", () => {
    it("5. Counselor accessing own dashboard via 'me' is allowed (200)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(COUNSELOR_ID);
      expect(body.data.staffCode).toBe(COUNSELOR_STAFF_CODE);
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: COUNSELOR_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("6. Counselor accessing own dashboard via explicit own _id is allowed (200)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(`http://localhost:3000/api/v1/counselors/${COUNSELOR_ID}/dashboard`);
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: COUNSELOR_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(COUNSELOR_ID);
    });

    it("7. Counselor accessing own dashboard via explicit own staffCode is allowed (200)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(`http://localhost:3000/api/v1/counselors/${COUNSELOR_STAFF_CODE}/dashboard`);
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: COUNSELOR_STAFF_CODE }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(COUNSELOR_ID);
    });

    it("8. Counselor accessing another counselor in same school is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      MCounselor.findOne.mockReturnValue(mockSelectLean(OWN_COUNSELOR_DOC));

      const req = new NextRequest(`http://localhost:3000/api/v1/counselors/${OTHER_COUNSELOR_ID}/dashboard`);
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: OTHER_COUNSELOR_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("9. Counselor accessing another counselor's staffCode in same school is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      MCounselor.findOne.mockReturnValue(mockSelectLean(OWN_COUNSELOR_DOC));

      const req = new NextRequest(`http://localhost:3000/api/v1/counselors/${OTHER_COUNSELOR_STAFF_CODE}/dashboard`);
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: OTHER_COUNSELOR_STAFF_CODE }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it("10. Counselor accessing a counselor from another school is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      MCounselor.findOne.mockReturnValue(mockSelectLean(OWN_COUNSELOR_DOC));

      const foreignCounselorId = "64a1b2c3d4e5f6a7b8c9dc99";
      const req = new NextRequest(`http://localhost:3000/api/v1/counselors/${foreignCounselorId}/dashboard`);
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: foreignCounselorId }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });

  // ==========================================
  // C. FAIL-CLOSED FOR OTHER ROLES
  // ==========================================
  describe("C. Fail-Closed for Other Roles", () => {
    it("11. Admin role is denied (403) per least-privilege & authorization matrix", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("12. Student role is denied (403)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it("13. Parent role is denied (403)", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it("14. Teacher role is denied (403)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it("15. Unknown role is denied (403)", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d099",
        role: "guest" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });

  // ==========================================
  // D. PROFILE INTEGRITY & TENANT ISOLATION
  // ==========================================
  describe("D. Profile Integrity & Tenant Isolation", () => {
    it("16. Inactive counselor profile is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      // Inactive counselor query returns null
      MCounselor.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("17. Cross-school counselor is denied (token for School B, but profile only in School A)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_B,
      });
      setCookieToken(token);

      // Looking up in School B returns null
      MCounselor.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: COUNSELOR_USER_ID,
        schoolId: SCHOOL_B,
        isActive: true,
      });
    });

    it("18. No first-counselor or global fallback occurs when resolving 'me'", async () => {
      const token = await makeToken({
        userId: OTHER_COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });

      expect(res.status).toBe(403);
      // Verify findOne was strictly scoped with userId and schoolId
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: OTHER_COUNSELOR_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("19. Underlying database queries are strictly scoped to authenticated schoolId", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });

      // SafetyReport queries scoped to SCHOOL_A
      expect(MSafetyReport.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MSafetyReport.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );

      // Aggregations scoped to SCHOOL_A
      expect(MAttendanceRecord.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({ schoolId: SCHOOL_A }),
          }),
        ])
      );
      expect(MMoodCheckin.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({ schoolId: SCHOOL_A }),
          }),
        ])
      );

      // Student query scoped to SCHOOL_A
      expect(MStudent.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
    });
  });

  // ==========================================
  // E. SPOOFING IMMUNITY & QUERY GATING
  // ==========================================
  describe("E. Spoofing Immunity & Query Gating", () => {
    it("20. Forged x-user-role header cannot elevate student to counselor", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard", {
        headers: { "x-user-role": "counselor" },
      });
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MCounselor.findOne).not.toHaveBeenCalled();
    });

    it("21. Forged x-user-id header cannot alter target counselor identity", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard", {
        headers: { "x-user-id": OTHER_COUNSELOR_USER_ID },
      });
      await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });

      // Must resolve using the JWT's userId, NOT the header
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: COUNSELOR_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("22. Unauthorized request does not execute any dashboard queries", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });

      expect(MSafetyReport.find).not.toHaveBeenCalled();
      expect(MSafetyReport.countDocuments).not.toHaveBeenCalled();
      expect(MAttendanceRecord.aggregate).not.toHaveBeenCalled();
      expect(MMoodCheckin.aggregate).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // F. RESPONSE SHAPE PRESERVATION
  // ==========================================
  describe("F. Response Shape Preservation", () => {
    it("23. Successful dashboard response retains all expected metrics and sections", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/counselors/me/dashboard");
      const res = await getCounselorDashboardRoute(req, {
        params: Promise.resolve({ counselorId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const data = body.data;
      expect(data).toHaveProperty("id", COUNSELOR_ID);
      expect(data).toHaveProperty("staffCode", COUNSELOR_STAFF_CODE);
      expect(data).toHaveProperty("name", "Sunita Rao");
      expect(data).toHaveProperty("role", "Lead Counselor");
      expect(data).toHaveProperty("metrics");
      expect(data.metrics).toHaveProperty("openCases");
      expect(data.metrics).toHaveProperty("highPriority");
      expect(data.metrics).toHaveProperty("safetyReports");
      expect(data.metrics).toHaveProperty("followUpsDue");
      expect(data).toHaveProperty("priorityCases");
      expect(Array.isArray(data.priorityCases)).toBe(true);
      expect(data).toHaveProperty("wellbeingTrends");
      expect(data).toHaveProperty("caseCategories");
      expect(data).toHaveProperty("activeInterventions");
      expect(data).toHaveProperty("followUpsDue");
      expect(data).toHaveProperty("safetyReports");
      expect(data).toHaveProperty("riskInsights");
      expect(data).toHaveProperty("recentActivity");
    });
  });
});
