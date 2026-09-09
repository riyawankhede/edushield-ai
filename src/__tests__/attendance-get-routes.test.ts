/**
 * Security and Authorization Tests for GET /api/v1/attendance
 *
 * Phase 2J CRIT-4 Security Hardening:
 * 1. Missing authentication -> 401
 * 2. Invalid / malformed token -> 401
 * 3. Expired token -> 401
 * 4. Student own attendance -> allowed (200)
 * 5. Student attempting another student's attendance -> denied (403)
 * 6. Parent linked child attendance -> allowed (200)
 * 7. Parent attempting unrelated child -> denied (403)
 * 8. Parent cross-school child -> denied (403)
 * 9. Teacher own authorized class attendance -> allowed (200)
 * 10. Teacher unassigned class -> denied (403)
 * 11. Teacher attempting another student's unauthorized attendance -> denied (403)
 * 12. Counselor behavior matches authorization matrix (same-school allowed, cross-school denied)
 * 13. Admin behavior matches authorization matrix (same-school allowed, cross-school denied)
 * 14. Cross-school attendance cannot leak (tenant isolation via auth.schoolId)
 * 15. Arbitrary studentId cannot bypass authorization
 * 16. Arbitrary classId cannot bypass teacher authorization
 * 17. Spoofed x-user-role header cannot change authorization
 * 18. Spoofed x-user-id header cannot change authorization
 * 19. Unauthorized requests execute no AttendanceRecord query (query gating)
 * 20. Combined filters cannot bypass authorization
 * 21. Inactive profile denied where applicable
 * 22. Existing response shape preserved ({ success: true, data: [...], meta: { ... } })
 * 23. Existing pagination/filter behavior preserved (page, pageSize, date, classId, studentId, status)
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getAttendanceRoute } from "@/app/api/v1/attendance/route";
import {
  AttendanceRecord,
  Student,
  Parent,
  ParentStudentRelationship,
  Teacher,
  TeacherClassAssignment,
  Counselor,
  Admin,
  Class,
} from "@/models";
import type { UserRole } from "@/types/identity";

// Mock next/headers (cookies)
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Mock database connection
jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

// Mock Mongoose models
jest.mock("@/models", () => ({
  AttendanceRecord: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Student: {
    findOne: jest.fn(),
    find: jest.fn(),
  },
  Parent: {
    findOne: jest.fn(),
  },
  ParentStudentRelationship: {
    find: jest.fn(),
  },
  Teacher: {
    findOne: jest.fn(),
  },
  TeacherClassAssignment: {
    find: jest.fn(),
  },
  Counselor: {
    findOne: jest.fn(),
  },
  Admin: {
    findOne: jest.fn(),
  },
  Class: {
    findOne: jest.fn(),
  },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

const MAttendanceRecord = AttendanceRecord as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MStudent = Student as unknown as {
  findOne: jest.Mock;
  find: jest.Mock;
};
const MParent = Parent as unknown as { findOne: jest.Mock };
const MParentStudentRel = ParentStudentRelationship as unknown as { find: jest.Mock };
const MTeacher = Teacher as unknown as { findOne: jest.Mock };
const MTeacherClassAssignment = TeacherClassAssignment as unknown as { find: jest.Mock };
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };
const MClass = Class as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d101";

const OTHER_STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d102";
const FOREIGN_STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d199";

const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const PARENT_ID = "64a1b2c3d4e5f6a7b8c9d201";

const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const TEACHER_ID = "64a1b2c3d4e5f6a7b8c9d301";

const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const COUNSELOR_ID = "64a1b2c3d4e5f6a7b8c9d401";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9d501";

const CLASS_1_ID = "64a1b2c3d4e5f6a7b8c9c001";
const CLASS_2_ID = "64a1b2c3d4e5f6a7b8c9c002";
const UNASSIGNED_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c999";
const FOREIGN_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c888";

const STUDENT_DOC = {
  _id: STUDENT_ID,
  userId: STUDENT_USER_ID,
  schoolId: SCHOOL_A,
  classId: CLASS_1_ID,
  isActive: true,
};

const PARENT_DOC = {
  _id: PARENT_ID,
  userId: PARENT_USER_ID,
  schoolId: SCHOOL_A,
};

const TEACHER_DOC = {
  _id: TEACHER_ID,
  userId: TEACHER_USER_ID,
  schoolId: SCHOOL_A,
  isActive: true,
};

const COUNSELOR_DOC = {
  _id: COUNSELOR_ID,
  userId: COUNSELOR_USER_ID,
  schoolId: SCHOOL_A,
  isActive: true,
};

const ADMIN_DOC = {
  _id: ADMIN_ID,
  userId: ADMIN_USER_ID,
  schoolId: SCHOOL_A,
  isActive: true,
};

const SAMPLE_RECORDS = [
  {
    _id: "rec_1",
    studentId: STUDENT_ID,
    classId: CLASS_1_ID,
    date: new Date("2026-09-01"),
    status: "present",
    remarks: "On time",
    schoolId: SCHOOL_A,
  },
  {
    _id: "rec_2",
    studentId: STUDENT_ID,
    classId: CLASS_1_ID,
    date: new Date("2026-09-02"),
    status: "late",
    remarks: "Bus delay",
    schoolId: SCHOOL_A,
  },
];

async function makeToken(
  payload: { userId: string; role: UserRole | string; schoolId: string },
  expiresIn = "15m",
  secret = TEST_SECRET
) {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT(payload as Record<string, unknown>)
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

function setupAttendanceMocks(records = SAMPLE_RECORDS) {
  const recordLean = jest.fn().mockResolvedValue(records);
  const recordLimit = jest.fn().mockReturnValue({ lean: recordLean });
  const recordSkip = jest.fn().mockReturnValue({ limit: recordLimit });
  const recordSort = jest.fn().mockReturnValue({ skip: recordSkip });
  MAttendanceRecord.find.mockReturnValue({ sort: recordSort });

  MAttendanceRecord.countDocuments.mockResolvedValue(records.length);
}

describe("GET /api/v1/attendance - Security Tests", () => {
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
  // 1-3: AUTHENTICATION
  // ==========================================
  describe("1-3. Authentication", () => {
    it("1. Missing authentication (no cookie) returns 401", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("invalid.token.here");
      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("3a. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "-5m"
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("3b. JWT signed with foreign secret returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_SECRET
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 4-5: STUDENT ROLE AUTHORIZATION
  // ==========================================
  describe("4-5. Student Role Authorization", () => {
    it("4. Student accessing own attendance returns 200", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);

      // Verify query is strictly scoped to own studentId and schoolId
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("4b. Student passing 'me' as studentId resolves to own attendance", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        "http://localhost:3000/api/v1/attendance?studentId=me"
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("5. Student attempting another student's attendance returns 403", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("5b. Inactive student profile returns 403", async () => {
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 6-8: PARENT ROLE AUTHORIZATION
  // ==========================================
  describe("6-8. Parent Role Authorization", () => {
    beforeEach(() => {
      MParent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(PARENT_DOC),
        }),
      });
      MParentStudentRel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ studentId: STUDENT_ID }]),
        }),
      });
    });

    it("6. Parent accessing linked child attendance returns 200", async () => {
      setupAttendanceMocks();
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
        })
      );
    });

    it("6b. Parent without studentId param retrieves all linked children attendance", async () => {
      setupAttendanceMocks();
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          studentId: expect.objectContaining({
            $in: expect.any(Array),
          }),
        })
      );
    });

    it("7. Parent attempting unrelated child attendance returns 403", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("8. Parent attempting cross-school child returns 403", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${FOREIGN_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 9-11: TEACHER ROLE AUTHORIZATION
  // ==========================================
  describe("9-11. Teacher Role Authorization", () => {
    beforeEach(() => {
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(TEACHER_DOC),
      });
      MTeacherClassAssignment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { classId: CLASS_1_ID },
            { classId: CLASS_2_ID },
          ]),
        }),
      });
    });

    it("9. Teacher accessing attendance for own assigned class returns 200", async () => {
      setupAttendanceMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?classId=${CLASS_1_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          classId: expect.anything(),
        })
      );
    });

    it("10. Teacher attempting unassigned class returns 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?classId=${UNASSIGNED_CLASS_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("11. Teacher attempting a student from an unassigned class returns 403", async () => {
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null), // student not found in teacher's assigned classes
        }),
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("11b. Inactive teacher profile returns 403", async () => {
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 12-13: COUNSELOR & ADMIN AUTHORIZATION
  // ==========================================
  describe("12-13. Counselor & Admin Authorization", () => {
    it("12. Counselor accessing same-school attendance is allowed (200)", async () => {
      setupAttendanceMocks();
      MCounselor.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(COUNSELOR_DOC),
        }),
      });

      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
        })
      );
    });

    it("12b. Counselor querying student from another school returns 403", async () => {
      MCounselor.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(COUNSELOR_DOC),
        }),
      });
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null), // cross-school student
        }),
      });

      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?studentId=${FOREIGN_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("13. Admin accessing same-school attendance is allowed (200)", async () => {
      setupAttendanceMocks();
      MAdmin.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(ADMIN_DOC),
        }),
      });

      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
        })
      );
    });

    it("13b. Admin querying class from another school returns 403", async () => {
      MAdmin.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(ADMIN_DOC),
        }),
      });
      MClass.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null), // foreign class
        }),
      });

      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?classId=${FOREIGN_CLASS_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 14-23: TENANT ISOLATION, ANTI-SPOOFING & GATING
  // ==========================================
  describe("14-23. Tenant Isolation, Gating & Contract Preservation", () => {
    it("14. Cross-school attendance cannot leak: all queries enforce auth.schoolId", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      await getAttendanceRoute(req);

      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MAttendanceRecord.find).not.toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_B })
      );
    });

    it("17 & 18. Spoofed x-user-role and x-user-id headers are completely ignored", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance", {
        headers: {
          "x-user-role": "admin",
          "x-user-id": ADMIN_USER_ID,
        },
      });
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // Evaluated as student, NOT admin
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ userId: STUDENT_USER_ID })
      );
    });

    it("19. Unauthorized requests execute no AttendanceRecord query (query gating)", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      await getAttendanceRoute(req);

      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
      expect(MAttendanceRecord.countDocuments).not.toHaveBeenCalled();
    });

    it("20. Combined filters cannot bypass authorization", async () => {
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(TEACHER_DOC),
      });
      MTeacherClassAssignment.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ classId: CLASS_1_ID }]),
        }),
      });
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null), // student is NOT in teacher's class
        }),
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/attendance?classId=${CLASS_1_ID}&studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAttendanceRecord.find).not.toHaveBeenCalled();
    });

    it("22. Existing response shape preserved with meta pagination", async () => {
      setupAttendanceMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/attendance");
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it("23. Date and status filters are correctly applied to AttendanceRecord query", async () => {
      setupAttendanceMocks();
      MAdmin.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(ADMIN_DOC),
        }),
      });

      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        "http://localhost:3000/api/v1/attendance?date=2026-09-01&status=present&page=2&pageSize=10"
      );
      const res = await getAttendanceRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MAttendanceRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          status: "present",
          date: expect.objectContaining({
            $gte: expect.any(Date),
            $lt: expect.any(Date),
          }),
        })
      );
    });
  });
});
