/**
 * Tests for JWT-protected GET /api/v1/safety/reports
 *
 * Phase 2J CRIT-1 Security Hardening:
 * - AUTHENTICATION: missing, malformed, expired, foreign-secret JWT returns 401
 * - ROLE AUTHORIZATION: student, parent, teacher, unknown roles return 403
 * - AUTHORIZED ROLES: active same-school counselor and admin succeed (200)
 * - PROFILE VERIFICATION: missing or inactive counselor/admin profile returns 403
 * - TENANT ISOLATION: queries are strictly scoped to auth.schoolId; foreign school reports never returned
 * - SPOOFING IMMUNITY: x-user-role, x-user-id, ?role= cannot elevate privileges or bypass JWT
 * - ANONYMITY PROTECTION: anonymous reports strip reporterStudentId and populated reporter identity
 * - QUERY GATING: sensitive SafetyReport queries never run when authentication or authorization fails
 * - PAGINATION & FILTERS: preserves pagination bounding (1-100) and status filtering
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getSafetyReports } from "@/app/api/v1/safety/reports/route";
import { SafetyReport, Counselor, Admin } from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  SafetyReport: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Counselor: {
    findOne: jest.fn(),
  },
  Admin: {
    findOne: jest.fn(),
  },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MSafetyReport = SafetyReport as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";

const SAMPLE_REPORTS_SCHOOL_A = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9d101",
    schoolId: SCHOOL_A,
    reportType: "bullying",
    description: "Bullying incident reported behind gym",
    locationDescription: "Behind Gymnasium",
    status: "new",
    isAnonymous: true,
    reporterStudentId: {
      _id: "64a1b2c3d4e5f6a7b8c9d999",
      firstName: "Secret",
      lastName: "Student",
      studentCode: "STU-ANON",
      grade: "10",
      section: "A",
    },
    nlpSignals: { severity: "high", signalType: "bullying" },
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9d102",
    schoolId: SCHOOL_A,
    reportType: "physical_threat",
    description: "Altercation in cafeteria corridor",
    locationDescription: "Cafeteria Corridor",
    status: "under_review",
    isAnonymous: false,
    reporterStudentId: {
      _id: "64a1b2c3d4e5f6a7b8c9d888",
      firstName: "Aarav",
      lastName: "Patel",
      studentCode: "STU-102",
      grade: "11",
      section: "B",
    },
    nlpSignals: { severity: "medium", signalType: "physical_threat" },
    createdAt: new Date("2026-09-02T11:00:00Z"),
    updatedAt: new Date("2026-09-02T11:00:00Z"),
  },
];

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

interface SerializedSafetyReportTest {
  _id: string;
  schoolId: string;
  reportType: string;
  description: string;
  locationDescription: string;
  status: string;
  isAnonymous: boolean;
  nlpSignals?: { severity: string; signalType: string };
  reporterStudent?: {
    _id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    grade: string;
    section: string;
  };
  reporterStudentId?: unknown;
  createdAt: Date;
  updatedAt: Date;
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
  };
}

function setupFindMock(records: unknown[]) {
  const lean = jest.fn().mockResolvedValue(records);
  const populate = jest.fn().mockReturnValue({ lean });
  const limit = jest.fn().mockReturnValue({ populate });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  MSafetyReport.find.mockReturnValue({ sort });
  return { sort, skip, limit, populate, lean };
}

describe("GET /api/v1/safety/reports - Security Tests", () => {
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
    it("1. Missing JWT returns 401 and does not execute queries", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
      expect(MSafetyReport.countDocuments).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401 and does not execute queries", async () => {
      setCookieToken("invalid.malformed.token");
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("3. Expired JWT returns 401 and does not execute queries", async () => {
      const token = await makeToken(
        { userId: COUNSELOR_USER_ID, role: "counselor", schoolId: SCHOOL_A },
        "-1s"
      );
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("4. Invalid/foreign-secret JWT returns 401 and does not execute queries", async () => {
      const token = await makeToken(
        { userId: COUNSELOR_USER_ID, role: "counselor", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_TEST_SECRET
      );
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // B. ROLE AUTHORIZATION (FAIL CLOSED)
  // ==========================================
  describe("B. Role Authorization (Fail Closed)", () => {
    it("5. Student role is denied with 403", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("6. Parent role is denied with 403", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("7. Teacher role is denied with 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("8. Unknown role is denied with 403", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d099",
        role: "guest" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);
      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // C. AUTHORIZED ROLES & PROFILE VERIFICATION
  // ==========================================
  describe("C. Authorized Roles & Profile Verification", () => {
    it("9. Active same-school counselor receives 200 with safety reports", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(SAMPLE_REPORTS_SCHOOL_A.length);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: COUNSELOR_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("10. Active same-school admin receives 200 with safety reports", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(
        mockSelectLean({ _id: "admin_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(SAMPLE_REPORTS_SCHOOL_A.length);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(MAdmin.findOne).toHaveBeenCalledWith({
        userId: ADMIN_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("11. Missing or inactive counselor profile returns 403", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("12. Missing or inactive admin profile returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // D. TENANT ISOLATION
  // ==========================================
  describe("D. Tenant Isolation", () => {
    it("13. School A counselor queries are strictly scoped to School A", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      await getSafetyReports(req);

      expect(MSafetyReport.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MSafetyReport.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
    });

    it("14. School B counselor cannot see School A reports", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_B,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_b_doc_id" })
      );
      setupFindMock([]);
      MSafetyReport.countDocuments.mockResolvedValue(0);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(MSafetyReport.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_B })
      );
    });

    it("15. Returned records all belong to auth.schoolId", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(
        mockSelectLean({ _id: "admin_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      for (const report of body.data) {
        expect(report.schoolId).toBe(SCHOOL_A);
      }
    });
  });

  // ==========================================
  // E. HEADER & QUERY SPOOFING IMMUNITY
  // ==========================================
  describe("E. Header & Query Spoofing Immunity", () => {
    it("16. Forged x-user-role header cannot elevate a student to counselor", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports", {
        headers: { "x-user-role": "counselor" },
      });
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("17. Forged x-user-id header cannot change the authenticated identity", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports", {
        headers: { "x-user-id": "64a1b2c3d4e5f6a7b8c9d999" },
      });
      await getSafetyReports(req);

      // Must resolve using JWT userId, not the header
      expect(MCounselor.findOne).toHaveBeenCalledWith({
        userId: COUNSELOR_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("18. ?role=counselor query param cannot bypass JWT authentication", async () => {
      setCookieToken(undefined);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports?role=counselor");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("19. ?role=admin query param cannot bypass JWT authentication", async () => {
      setCookieToken(undefined);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports?role=admin");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // F. ANONYMITY PROTECTION
  // ==========================================
  describe("F. Anonymity Protection", () => {
    it("20. Anonymous report does NOT expose reporterStudentId", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      const anonReport = (body.data as SerializedSafetyReportTest[]).find(
        (r) => r.isAnonymous === true
      );
      expect(anonReport).toBeDefined();
      expect(anonReport?.reporterStudentId).toBeUndefined();
      expect(anonReport?.reporterStudent).toBeUndefined();
    });

    it("21. Anonymous report does NOT expose populated reporter name or studentCode", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(
        mockSelectLean({ _id: "admin_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      const anonReport = (body.data as SerializedSafetyReportTest[]).find(
        (r) => r.isAnonymous === true
      );
      const rawString = JSON.stringify(anonReport);
      expect(rawString).not.toContain("Secret");
      expect(rawString).not.toContain("STU-ANON");
    });

    it("22. Non-anonymous report includes authorized reporter information", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      const res = await getSafetyReports(req);
      const body = await res.json();

      const identifiedReport = (body.data as SerializedSafetyReportTest[]).find(
        (r) => r.isAnonymous === false
      );
      expect(identifiedReport).toBeDefined();
      expect(identifiedReport?.reporterStudent).toBeDefined();
      expect(identifiedReport?.reporterStudent?.firstName).toBe("Aarav");
      expect(identifiedReport?.reporterStudent?.studentCode).toBe("STU-102");
    });
  });

  // ==========================================
  // G. QUERY GATING
  // ==========================================
  describe("G. Query Gating", () => {
    it("23. Unauthorized request does not execute SafetyReport.find()", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      await getSafetyReports(req);

      expect(MSafetyReport.find).not.toHaveBeenCalled();
    });

    it("24. Unauthorized request does not execute SafetyReport.countDocuments()", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports");
      await getSafetyReports(req);

      expect(MSafetyReport.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // H. PAGINATION & STATUS FILTERING
  // ==========================================
  describe("H. Pagination & Status Filtering", () => {
    it("25. Pagination behavior passes skip/limit correctly and returns meta", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      const findChain = setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(25);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports?page=2&pageSize=10");
      const res = await getSafetyReports(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(findChain.skip).toHaveBeenCalledWith(10);
      expect(findChain.limit).toHaveBeenCalledWith(10);
      expect(body.meta).toEqual({
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("26. pageSize is bounded between 1 and 100", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      const findChain = setupFindMock(SAMPLE_REPORTS_SCHOOL_A);
      MSafetyReport.countDocuments.mockResolvedValue(2);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports?pageSize=999");
      await getSafetyReports(req);

      expect(findChain.limit).toHaveBeenCalledWith(100);
    });

    it("27. Status filter is passed to the database query", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(
        mockSelectLean({ _id: "counselor_doc_id" })
      );
      setupFindMock([SAMPLE_REPORTS_SCHOOL_A[1]]);
      MSafetyReport.countDocuments.mockResolvedValue(1);

      const req = new NextRequest("http://localhost:3000/api/v1/safety/reports?status=under_review");
      const res = await getSafetyReports(req);

      expect(res.status).toBe(200);
      expect(MSafetyReport.find).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        status: "under_review",
      });
      expect(MSafetyReport.countDocuments).toHaveBeenCalledWith({
        schoolId: SCHOOL_A,
        status: "under_review",
      });
    });
  });
});
