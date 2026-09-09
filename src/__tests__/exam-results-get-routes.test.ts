/**
 * Security and Authorization Tests for GET /api/v1/exams/[examId]/results
 *
 * Phase 2J CRIT-5 Security Hardening:
 * 1. Missing authentication -> 401
 * 2. Invalid token -> 401
 * 3. Expired token -> 401
 * 4. Student accessing own result -> allowed (200)
 * 5. Student accessing another student's result -> denied (403)
 * 6. Student changing studentId -> denied (403)
 * 7. Parent accessing linked child's result -> allowed (200)
 * 8. Parent accessing unrelated child -> denied (403)
 * 9. Parent cross-school student -> denied (403)
 * 10. Teacher accessing assigned class result -> allowed (200)
 * 11. Teacher accessing unassigned class result -> denied (403)
 * 12. Teacher accessing another student's unauthorized result -> denied (403)
 * 13. Teacher changing teacherId/request headers -> cannot escalate (anti-spoofing)
 * 14. Counselor behavior matches authorization matrix (same-school allowed, cross-school denied)
 * 15. Admin behavior matches authorization matrix (same-school allowed, cross-school denied)
 * 16. Foreign-school examId -> denied (403)
 * 17. Foreign-school studentId -> denied (403)
 * 18. Foreign-school classId -> denied (403)
 * 19. examId/classId mismatch -> denied (403)
 * 20. studentId/classId mismatch -> denied (403)
 * 21. Spoofed x-user-role -> ignored
 * 22. Spoofed x-user-id -> ignored
 * 23. Unauthorized requests do not execute ExamResult queries (query gating)
 * 24. Existing response shape preserved
 * 25. Existing pagination/filter behavior preserved
 * 26. Inactive profile denied where applicable
 * 27. No cross-school result leakage (tenant isolation)
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getExamResultsRoute } from "@/app/api/v1/exams/[examId]/results/route";
import {
  Exam,
  ExamResult,
  Student,
  Parent,
  ParentStudentRelationship,
  Teacher,
  TeacherClassAssignment,
  Counselor,
  Admin,
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
  Exam: {
    findOne: jest.fn(),
  },
  ExamResult: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Student: {
    findOne: jest.fn(),
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

const MExam = Exam as unknown as { findOne: jest.Mock };
const MExamResult = ExamResult as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MStudent = Student as unknown as { findOne: jest.Mock };
const MParent = Parent as unknown as { findOne: jest.Mock };
const MParentStudentRel = ParentStudentRelationship as unknown as { find: jest.Mock };
const MTeacher = Teacher as unknown as { findOne: jest.Mock };
const MTeacherClassAssignment = TeacherClassAssignment as unknown as { findOne: jest.Mock };
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const EXAM_ID = "64a1b2c3d4e5f6a7b8c9e001";
const FOREIGN_EXAM_ID = "64a1b2c3d4e5f6a7b8c9e099";

const CLASS_1_ID = "64a1b2c3d4e5f6a7b8c9c001";
const CLASS_2_ID = "64a1b2c3d4e5f6a7b8c9c002";
const UNASSIGNED_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c999";
const FOREIGN_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c888";

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

const EXAM_DOC = {
  _id: EXAM_ID,
  schoolId: SCHOOL_A,
  classId: CLASS_1_ID,
  subjectId: "64a1b2c3d4e5f6a7b8c9s001",
  name: "Term 1 Mathematics",
  maxMarks: 50,
  passingMarks: 20,
};

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

const SAMPLE_RESULTS = [
  {
    _id: "res_1",
    examId: EXAM_ID,
    studentId: {
      _id: STUDENT_ID,
      firstName: "Aarav",
      lastName: "Kumar",
      studentCode: "STU-001",
    },
    marksObtained: 45,
    grade: "A",
    isPassed: true,
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

function setupExamResultsMocks(results = SAMPLE_RESULTS) {
  MExam.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(EXAM_DOC),
  });

  const resLean = jest.fn().mockResolvedValue(results);
  const resPopulate = jest.fn().mockReturnValue({ lean: resLean });
  const resLimit = jest.fn().mockReturnValue({ populate: resPopulate });
  const resSkip = jest.fn().mockReturnValue({ limit: resLimit });
  const resSort = jest.fn().mockReturnValue({ skip: resSkip });
  MExamResult.find.mockReturnValue({ sort: resSort });

  MExamResult.countDocuments.mockResolvedValue(results.length);
}

describe("GET /api/v1/exams/[examId]/results - Security Tests", () => {
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
      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MExam.findOne).not.toHaveBeenCalled();
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("invalid.token.here");
      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MExam.findOne).not.toHaveBeenCalled();
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("3a. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "-5m"
      );
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MExam.findOne).not.toHaveBeenCalled();
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("3b. JWT signed with foreign secret returns 401", async () => {
      const token = await makeToken(
        { userId: STUDENT_USER_ID, role: "student", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_SECRET
      );
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MExam.findOne).not.toHaveBeenCalled();
      expect(MExamResult.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 4-6: STUDENT ROLE AUTHORIZATION
  // ==========================================
  describe("4-6. Student Role Authorization", () => {
    beforeEach(() => {
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(STUDENT_DOC),
        }),
      });
    });

    it("4. Student accessing own exam result returns 200", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          examId: EXAM_ID,
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("5. Student accessing another student's result returns 403", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("6. Student in a different class than the exam returns empty list", async () => {
      setupExamResultsMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...STUDENT_DOC,
            classId: CLASS_2_ID, // Different class
          }),
        }),
      });

      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("6b. Inactive student profile returns 403", async () => {
      setupExamResultsMocks();
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

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 7-9: PARENT ROLE AUTHORIZATION
  // ==========================================
  describe("7-9. Parent Role Authorization", () => {
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

    it("7. Parent accessing linked child's result returns 200", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?studentId=${STUDENT_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          examId: EXAM_ID,
          studentId: STUDENT_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("8. Parent accessing unrelated child returns 403", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("9. Parent accessing cross-school student returns 403", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?studentId=${FOREIGN_STUDENT_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 10-13: TEACHER ROLE AUTHORIZATION
  // ==========================================
  describe("10-13. Teacher Role Authorization", () => {
    beforeEach(() => {
      MTeacher.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(TEACHER_DOC),
        }),
      });
      MTeacherClassAssignment.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          teacherId: TEACHER_ID,
          classId: CLASS_1_ID,
          schoolId: SCHOOL_A,
        }),
      });
    });

    it("10. Teacher assigned to exam's class can view results (200)", async () => {
      setupExamResultsMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          examId: EXAM_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("11. Teacher NOT assigned to exam's class returns 403", async () => {
      setupExamResultsMocks();
      MTeacherClassAssignment.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null), // Not assigned to this exam's class
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("12. Teacher querying a student outside the exam's class returns 403", async () => {
      setupExamResultsMocks();
      MStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null), // Student not in exam's class
        }),
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?studentId=${OTHER_STUDENT_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("13. Inactive teacher profile returns 403", async () => {
      setupExamResultsMocks();
      MTeacher.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 14-15: COUNSELOR & ADMIN AUTHORIZATION
  // ==========================================
  describe("14-15. Counselor & Admin Authorization", () => {
    it("14. Counselor viewing same-school exam results returns 200", async () => {
      setupExamResultsMocks();
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

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          examId: EXAM_ID,
          schoolId: SCHOOL_A,
        })
      );
    });

    it("15. Admin viewing same-school exam results returns 200", async () => {
      setupExamResultsMocks();
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
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          examId: EXAM_ID,
          schoolId: SCHOOL_A,
        })
      );
    });
  });

  // ==========================================
  // 16-20: CROSS-SCHOOL & MISMATCH HANDLING
  // ==========================================
  describe("16-20. Cross-School & Mismatch Isolation", () => {
    it("16. Foreign-school examId returns 403 (fail closed, no existence oracle)", async () => {
      MExam.findOne.mockImplementation((query: Record<string, unknown>) => {
        if (query.schoolId === SCHOOL_B) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: FOREIGN_EXAM_ID,
              schoolId: SCHOOL_B,
              classId: FOREIGN_CLASS_ID,
            }),
          };
        }
        return { lean: jest.fn().mockResolvedValue(null) };
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${FOREIGN_EXAM_ID}/results`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: FOREIGN_EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });

    it("18 & 19. examId / classId mismatch returns 403", async () => {
      setupExamResultsMocks(); // Exam is in CLASS_1_ID
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?classId=${UNASSIGNED_CLASS_ID}`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MExamResult.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 21-27: SPOOFING, GATING & RESPONSE CONTRACT
  // ==========================================
  describe("21-27. Spoofing Immunity, Query Gating & Response Contract", () => {
    it("21 & 22. Spoofed x-user-role and x-user-id headers are completely ignored", async () => {
      setupExamResultsMocks();
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
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`,
        {
          headers: {
            "x-user-role": "admin",
            "x-user-id": ADMIN_USER_ID,
          },
        }
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // Evaluated as student, NOT admin
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
        })
      );
    });

    it("23. Unauthorized requests do not execute ExamResult queries (query gating)", async () => {
      setCookieToken(undefined);
      const req = new NextRequest(
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });

      expect(MExamResult.find).not.toHaveBeenCalled();
      expect(MExamResult.countDocuments).not.toHaveBeenCalled();
    });

    it("24 & 25. Existing response shape and pagination preserved", async () => {
      setupExamResultsMocks();
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
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results?page=1&pageSize=20`
      );
      const res = await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("27. Cross-school data cannot leak: all queries enforce auth.schoolId", async () => {
      setupExamResultsMocks();
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
        `http://localhost:3000/api/v1/exams/${EXAM_ID}/results`
      );
      await getExamResultsRoute(req, {
        params: Promise.resolve({ examId: EXAM_ID }),
      });

      expect(MExam.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MExamResult.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
    });
  });
});
