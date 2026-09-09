/**
 * Security tests for GET /api/v1/admin/dashboard
 *
 * Phase 2J CRIT-6 Security Hardening:
 * - AUTHENTICATION: missing, malformed, expired, foreign-secret JWT returns 401
 * - ADMIN AUTHZ: only verified users with "admin" role can access (403 for student, teacher, parent, counselor, driver, unknown)
 * - PROFILE VERIFICATION: missing, inactive, or mismatched Admin profile returns 403
 * - TENANT ISOLATION: all underlying queries (Student, Teacher, Parent, Counselor, Bus, SafetyReport, AttendanceRecord) are strictly scoped to auth.schoolId
 * - SPOOFING IMMUNITY: x-user-role, x-user-id, and ?role= query params are ignored; cannot elevate privileges
 * - QUERY GATING: no sensitive metrics / database queries execute when authorization fails
 * - RESPONSE CONTRACT: legitimate admin receives correctly scoped dashboard metrics and personalized school profile
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getAdminDashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import {
  Admin,
  School,
  Student,
  Teacher,
  Parent,
  Counselor,
  Bus,
  SafetyReport,
  AttendanceRecord,
} from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Admin: {
    findOne: jest.fn(),
  },
  School: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  Student: {
    countDocuments: jest.fn(),
  },
  Teacher: {
    countDocuments: jest.fn(),
  },
  Parent: {
    countDocuments: jest.fn(),
  },
  Counselor: {
    countDocuments: jest.fn(),
  },
  Bus: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
  SafetyReport: {
    countDocuments: jest.fn(),
  },
  AttendanceRecord: {
    aggregate: jest.fn(),
  },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MAdmin = Admin as unknown as { findOne: jest.Mock };
const MSchool = School as unknown as { findById: jest.Mock; findOne: jest.Mock };
const MStudent = Student as unknown as { countDocuments: jest.Mock };
const MTeacher = Teacher as unknown as { countDocuments: jest.Mock };
const MParent = Parent as unknown as { countDocuments: jest.Mock };
const MCounselor = Counselor as unknown as { countDocuments: jest.Mock };
const MBus = Bus as unknown as { countDocuments: jest.Mock; find: jest.Mock };
const MSafetyReport = SafetyReport as unknown as { countDocuments: jest.Mock };
const MAttendanceRecord = AttendanceRecord as unknown as { aggregate: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9da01";

const OTHER_ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d011";

const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";
const DRIVER_USER_ID = "64a1b2c3d4e5f6a7b8c9d060";

const OWN_ADMIN_DOC = {
  _id: ADMIN_ID,
  userId: ADMIN_USER_ID,
  schoolId: SCHOOL_A,
  staffCode: "ADM-001",
  firstName: "Rajesh",
  lastName: "Mehta",
  isActive: true,
};

const SCHOOL_DOC = {
  _id: SCHOOL_A,
  name: "Delhi Public Senior Secondary School",
  code: "DPSSS",
  academicYearCurrent: "2026–27",
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
  MAdmin.findOne.mockReturnValue(mockSelectLean(OWN_ADMIN_DOC));
  MSchool.findById.mockReturnValue(mockSelectLean(SCHOOL_DOC));
  MSchool.findOne.mockReturnValue(mockSelectLean(SCHOOL_DOC));

  MStudent.countDocuments.mockResolvedValue(1250);
  MTeacher.countDocuments.mockResolvedValue(68);
  MParent.countDocuments.mockResolvedValue(940);
  MCounselor.countDocuments.mockResolvedValue(4);
  MBus.countDocuments.mockResolvedValue(12);
  MSafetyReport.countDocuments
    .mockResolvedValueOnce(18) // total safety reports
    .mockResolvedValueOnce(3); // open safety reports

  MAttendanceRecord.aggregate.mockResolvedValue([
    {
      _id: null,
      total: 1000,
      present: 940,
      absent: 40,
      late: 20,
    },
  ]);

  const busLean = jest.fn().mockResolvedValue([
    {
      _id: "bus_1",
      registrationNumber: "DL-01-AB-1234",
      isActive: true,
    },
    {
      _id: "bus_2",
      registrationNumber: "DL-01-AB-1235",
      isActive: false,
    },
  ]);
  const busLimit = jest.fn().mockReturnValue({ lean: busLean });
  MBus.find.mockReturnValue({ limit: busLimit });
}

describe("GET /api/v1/admin/dashboard - Security Tests", () => {
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
  // A. AUTHENTICATION TESTS
  // ==========================================
  describe("A. Authentication Failures", () => {
    it("1. Unauthenticated request returns 401", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("invalid.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });

    it("3. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: ADMIN_USER_ID, role: "admin", schoolId: SCHOOL_A },
        "-1s"
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });

    it("4. JWT signed with foreign secret returns 401", async () => {
      const token = await makeToken(
        { userId: ADMIN_USER_ID, role: "admin", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_TEST_SECRET
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // B. ROLE-BASED AUTHORIZATION TESTS (FAIL CLOSED)
  // ==========================================
  describe("B. Role-Based Authorization Failures (Fail-Closed)", () => {
    it("5. Student role is denied (403)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("6. Teacher role is denied (403)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("7. Parent role is denied (403)", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });

    it("8. Counselor role is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });

    it("9. Driver role is denied (403)", async () => {
      const token = await makeToken({
        userId: DRIVER_USER_ID,
        role: "driver" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });

    it("10. Unknown / guest role is denied (403)", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d099",
        role: "guest" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // C. ADMIN PROFILE VERIFICATION
  // ==========================================
  describe("C. Admin Profile Verification", () => {
    it("11. Missing Admin profile returns 403", async () => {
      const token = await makeToken({
        userId: OTHER_ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).toHaveBeenCalledWith({
        userId: OTHER_ADMIN_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("12. Inactive Admin profile returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      // findOne with isActive: true returns null when profile is inactive
      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("13. Admin profile in different school returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_B, // User claims School B in token
      });
      setCookieToken(token);

      // But Admin profile is in School A, so lookup with School B returns null
      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).toHaveBeenCalledWith({
        userId: ADMIN_USER_ID,
        schoolId: SCHOOL_B,
        isActive: true,
      });
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // D. TENANT ISOLATION & SCHOOL SCOPING
  // ==========================================
  describe("D. Tenant Isolation & School Scoping", () => {
    it("14. All database queries are strictly scoped to authenticated schoolId (School A)", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);

      expect(res.status).toBe(200);

      // School lookup scoped to SCHOOL_A
      expect(MSchool.findById).toHaveBeenCalledWith(SCHOOL_A);

      // Student count scoped to SCHOOL_A
      expect(MStudent.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Teacher count scoped to SCHOOL_A
      expect(MTeacher.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Parent count scoped to SCHOOL_A
      expect(MParent.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Counselor count scoped to SCHOOL_A
      expect(MCounselor.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Bus count scoped to SCHOOL_A
      expect(MBus.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Safety report counts scoped to SCHOOL_A
      expect(MSafetyReport.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
      });
      expect(MSafetyReport.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        status: { $ne: "resolved" },
      });

      // Attendance aggregation scoped to SCHOOL_A in $match
      expect(MAttendanceRecord.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              schoolId: SCHOOL_A,
            }),
          }),
        ])
      );

      // Bus fleet query scoped to SCHOOL_A
      expect(MBus.find).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
      });
    });

    it("15. Multi-tenant isolation: School B queries never inspect School A data", async () => {
      const token = await makeToken({
        userId: OTHER_ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_B,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(
        mockSelectLean({
          ...OWN_ADMIN_DOC,
          userId: OTHER_ADMIN_USER_ID,
          schoolId: SCHOOL_B,
        })
      );
      MSchool.findById.mockReturnValue(
        mockSelectLean({
          _id: SCHOOL_B,
          name: "St. Xavier Academy",
          academicYearCurrent: "2026–27",
        })
      );
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      await getAdminDashboardRoute(req);

      expect(MSchool.findById).toHaveBeenCalledWith(SCHOOL_B);
      expect(MStudent.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_B,
        isActive: true,
      });
      expect(MTeacher.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_B,
        isActive: true,
      });
      expect(MBus.find).toHaveBeenCalledWith({
        schoolId: SCHOOL_B,
      });
      expect(MAttendanceRecord.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              schoolId: SCHOOL_B,
            }),
          }),
        ])
      );
    });
  });

  // ==========================================
  // E. SPOOFING IMMUNITY & QUERY GATING
  // ==========================================
  describe("E. Spoofing Immunity & Query Gating", () => {
    it("16. Forged x-user-role header cannot elevate student to admin (403)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard", {
        headers: {
          "x-user-role": "admin",
          "x-user-id": ADMIN_USER_ID,
        },
      });
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("17. Forged ?role=admin query parameter cannot elevate teacher to admin (403)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard?role=admin");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("18. Forged x-user-role header while unauthenticated returns 401 (not default demo)", async () => {
      setCookieToken(undefined);

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard", {
        headers: {
          "x-user-role": "admin",
        },
      });
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // F. LEGITIMATE ADMIN SUCCESS CONTRACT
  // ==========================================
  describe("F. Legitimate Admin Success Contract", () => {
    it("19. Verified admin receives 200 with complete dashboard metrics and personalized school identity", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/admin/dashboard");
      const res = await getAdminDashboardRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const d = body.data;
      expect(d.name).toBe("Principal Rajesh Mehta");
      expect(d.schoolName).toBe("Delhi Public Senior Secondary School");
      expect(d.academicYear).toBe("2026–27");

      // Verify KPIs structure
      expect(Array.isArray(d.kpis)).toBe(true);
      expect(d.kpis.length).toBe(6);
      expect(d.kpis[0].title).toBe("Total Students");
      expect(d.kpis[0].value).toBe("1,250");
      expect(d.kpis[1].title).toBe("Teachers");
      expect(d.kpis[1].value).toBe("68");
      expect(d.kpis[2].title).toBe("Attendance Rate");
      expect(d.kpis[2].value).toBe("94%");
      expect(d.kpis[4].title).toBe("Safety Reports");
      expect(d.kpis[4].trend).toContain("Open: 3");
      expect(d.kpis[5].title).toBe("Active Buses");
      expect(d.kpis[5].value).toBe("12 / 12");

      // Verify attendance summary
      expect(d.attendanceSummary).toEqual({
        overallRate: 94,
        presentRate: 94,
        absentRate: 4,
        lateRate: 2,
      });

      // Verify transport fleet items
      expect(Array.isArray(d.transportData)).toBe(true);
      expect(d.transportData.length).toBe(2);
      expect(d.transportData[0].id).toContain("DL-01-AB-1234");
      expect(d.transportData[0].status).toBe("On Route");
      expect(d.transportData[1].id).toContain("DL-01-AB-1235");
      expect(d.transportData[1].status).toBe("In Maintenance");

      // Verify AI insights and action lists
      expect(Array.isArray(d.aiInsights)).toBe(true);
      expect(Array.isArray(d.priorityActions)).toBe(true);
      expect(Array.isArray(d.recentActivity)).toBe(true);
    });
  });
});
