/**
 * Security tests for GET /api/v1/notices
 *
 * Phase 2J CRIT-7 Security Hardening:
 * - AUTHENTICATION: missing, malformed, expired, foreign-secret JWT returns 401
 * - ROLE AUTHORIZATION: student, parent, teacher, counselor, admin are allowed; driver, guest, unknown roles return 403
 * - ACTIVE PROFILE VERIFICATION: missing or inactive profile in school returns 403
 * - TENANT ISOLATION: all Notice queries strictly scoped to auth.schoolId; cross-school query parameter returns 403
 * - AUDIENCE SCOPING: non-admin roles only see notices targeted to their role or school-wide (empty targetRoles)
 * - SPOOFING IMMUNITY: forged x-user-role, x-user-id, ?role= cannot bypass auth or elevate privileges
 * - QUERY GATING: no Notice queries execute when authentication or authorization fails
 * - FUNCTIONAL CONTRACT: legitimate request returns published notices with pagination meta
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getNoticesRoute } from "@/app/api/v1/notices/route";
import {
  Notice,
  Student,
  Teacher,
  Parent,
  Counselor,
  Admin,
} from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Notice: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Student: {
    findOne: jest.fn(),
  },
  Teacher: {
    findOne: jest.fn(),
  },
  Parent: {
    findOne: jest.fn(),
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
const MNotice = Notice as unknown as { find: jest.Mock; countDocuments: jest.Mock };
const MStudent = Student as unknown as { findOne: jest.Mock };
const MTeacher = Teacher as unknown as { findOne: jest.Mock };
const MParent = Parent as unknown as { findOne: jest.Mock };
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";
const DRIVER_USER_ID = "64a1b2c3d4e5f6a7b8c9d060";

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

function setupSuccessfulNoticeFind(notices: unknown[] = [], total = 0) {
  const noticeLean = jest.fn().mockResolvedValue(notices);
  const noticeLimit = jest.fn().mockReturnValue({ lean: noticeLean });
  const noticeSkip = jest.fn().mockReturnValue({ limit: noticeLimit });
  const noticeSort = jest.fn().mockReturnValue({ skip: noticeSkip });
  MNotice.find.mockReturnValue({ sort: noticeSort });
  MNotice.countDocuments.mockResolvedValue(total);
}

describe("GET /api/v1/notices - Security Tests", () => {
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
      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
      expect(MNotice.countDocuments).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("malformed.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("3. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "-1s"
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("4. JWT signed with foreign secret returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_TEST_SECRET
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // B. ROLE AUTHORIZATION & PROFILE INTEGRITY
  // ==========================================
  describe("B. Role Authorization & Profile Integrity", () => {
    it("5. Driver role is denied (403)", async () => {
      const token = await makeToken({
        userId: DRIVER_USER_ID,
        role: "driver" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("6. Unknown / guest role is denied (403)", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d099",
        role: "guest" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("7. Deactivated / missing student profile returns 403", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MStudent.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.findOne).toHaveBeenCalledWith({
        userId: STUDENT_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("8. Deactivated / missing teacher profile returns 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("9. Deactivated / missing parent profile returns 403", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MParent.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("10. Deactivated / missing counselor profile returns 403", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("11. Deactivated / missing admin profile returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // C. TENANT ISOLATION & AUDIENCE SCOPING
  // ==========================================
  describe("C. Tenant Isolation & Audience Scoping", () => {
    it("12. School A student receives only School A notices with student or school-wide audience", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MStudent.findOne.mockReturnValue(mockSelectLean({ _id: "stu_1" }));
      setupSuccessfulNoticeFind([
        { _id: "notice_1", title: "Sports Day", isPublished: true, schoolId: SCHOOL_A },
      ], 1);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify query includes schoolId = SCHOOL_A
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isPublished: true,
          $or: [
            { targetRoles: { $exists: false } },
            { targetRoles: { $size: 0 } },
            { targetRoles: "student" },
          ],
        })
      );
      expect(MNotice.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isPublished: true,
        })
      );
    });

    it("13. School B teacher query is strictly scoped to School B (never School A)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_B,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean({ _id: "tch_1" }));
      setupSuccessfulNoticeFind([], 0);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);

      expect(res.status).toBe(200);
      expect(MTeacher.findOne).toHaveBeenCalledWith({
        userId: TEACHER_USER_ID,
        schoolId: SCHOOL_B,
        isActive: true,
      });
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_B,
          isPublished: true,
          $or: [
            { targetRoles: { $exists: false } },
            { targetRoles: { $size: 0 } },
            { targetRoles: "teacher" },
          ],
        })
      );
    });

    it("14. Admin can view all notices published in their school", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean({ _id: "adm_1" }));
      setupSuccessfulNoticeFind([
        { _id: "notice_1", title: "Staff Meeting", isPublished: true },
        { _id: "notice_2", title: "Fee Circular", isPublished: true },
      ], 2);

      const req = new NextRequest("http://localhost:3000/api/v1/notices");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);

      // Admin does not have restrictive $or audience filter
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isPublished: true,
        })
      );
      const findArg = MNotice.find.mock.calls[0][0];
      expect(findArg.$or).toBeUndefined();
    });

    it("15. Admin can filter by targetRole", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean({ _id: "adm_1" }));
      setupSuccessfulNoticeFind([], 0);

      const req = new NextRequest("http://localhost:3000/api/v1/notices?targetRole=parent");
      const res = await getNoticesRoute(req);

      expect(res.status).toBe(200);
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          targetRoles: "parent",
        })
      );
    });
  });

  // ==========================================
  // D. SPOOFING IMMUNITY & QUERY GATING
  // ==========================================
  describe("D. Spoofing Immunity & Query Gating", () => {
    it("16. Forged x-user-role header cannot elevate student to admin (403 if trying to bypass audience)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MStudent.findOne.mockReturnValue(mockSelectLean({ _id: "stu_1" }));
      setupSuccessfulNoticeFind([], 0);

      const req = new NextRequest("http://localhost:3000/api/v1/notices", {
        headers: {
          "x-user-role": "admin",
          "x-user-id": ADMIN_USER_ID,
        },
      });
      await getNoticesRoute(req);

      // Verify audience scope remains student
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { targetRoles: { $exists: false } },
            { targetRoles: { $size: 0 } },
            { targetRoles: "student" },
          ],
        })
      );
    });

    it("17. Forged ?role=admin query param cannot bypass verified token role", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MParent.findOne.mockReturnValue(mockSelectLean({ _id: "par_1" }));
      setupSuccessfulNoticeFind([], 0);

      const req = new NextRequest("http://localhost:3000/api/v1/notices?role=admin");
      await getNoticesRoute(req);

      expect(MParent.findOne).toHaveBeenCalled();
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { targetRoles: { $exists: false } },
            { targetRoles: { $size: 0 } },
            { targetRoles: "parent" },
          ],
        })
      );
    });

    it("18. Client-supplied mismatched schoolId is rejected with 403 Forbidden", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean({ _id: "adm_1" }));

      const req = new NextRequest(`http://localhost:3000/api/v1/notices?schoolId=${SCHOOL_B}`);
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });

    it("19. Forged x-user-role while unauthenticated returns 401 (not demo bypass)", async () => {
      setCookieToken(undefined);

      const req = new NextRequest("http://localhost:3000/api/v1/notices", {
        headers: {
          "x-user-role": "admin",
        },
      });
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MNotice.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // E. FUNCTIONAL CONTRACT & PAGINATION
  // ==========================================
  describe("E. Functional Contract & Pagination", () => {
    it("20. Supports pagination and returns expected response envelope", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MCounselor.findOne.mockReturnValue(mockSelectLean({ _id: "cns_1" }));

      const sampleNotices = [
        {
          _id: "notice_1",
          title: "Mental Health Workshop",
          content: "Workshop details...",
          priority: "high",
          isPublished: true,
          publishedAt: new Date("2026-09-01"),
        },
      ];
      setupSuccessfulNoticeFind(sampleNotices, 45);

      const req = new NextRequest("http://localhost:3000/api/v1/notices?page=2&pageSize=10&priority=high");
      const res = await getNoticesRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta).toEqual({
        page: 2,
        pageSize: 10,
        total: 45,
        totalPages: 5,
      });

      expect(MNotice.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isPublished: true,
          priority: "high",
        })
      );
    });
  });
});
