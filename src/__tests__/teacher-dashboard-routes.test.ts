/**
 * Security and Authorization Tests for GET /api/v1/teachers/[teacherId]/dashboard
 *
 * Phase 2J CRIT-8 Security Hardening:
 * 1. Unauthenticated request -> 401
 * 2. Invalid / malformed / expired / foreign-secret token -> 401
 * 3. Student role -> 403
 * 4. Parent role -> 403
 * 5. Counselor role -> 403
 * 6. Driver role -> 403
 * 7. Unknown / invalid role -> 403
 * 8. Teacher accessing own dashboard ("me", "current", own _id, own staffCode) -> allowed (200)
 * 9. Teacher accessing another teacher in same school -> denied (403)
 * 10. Teacher accessing another school's teacher -> denied (403)
 * 11. "me" resolves to authenticated teacher only; no first-teacher global fallback
 * 12. Inactive teacher profile -> denied (403)
 * 13. Missing teacher profile -> denied (403)
 * 14. Admin accessing teacher in same school -> allowed (200)
 * 15. Admin using "me" or "current" -> denied (403)
 * 16. Admin accessing teacher in another school -> denied (403)
 * 17. Inactive admin profile -> denied (403)
 * 18. Teacher sees only metrics for assigned classes
 * 19. Unassigned class requested via ?classId= -> denied (403)
 * 20. Valid assigned class requested via ?classId= -> filters dashboard to that class (200)
 * 21. Forged x-user-role header cannot elevate student to teacher/admin
 * 22. Forged ?role=admin cannot bypass authorization
 * 23. Client-supplied schoolId cannot bypass tenant isolation
 * 24. Unauthorized requests do not execute protected dashboard queries (query gating)
 * 25. Response contract preserved without exposing unnecessary student PII
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getTeacherDashboardRoute } from "@/app/api/v1/teachers/[teacherId]/dashboard/route";
import {
  Teacher,
  TeacherClassAssignment,
  Class,
  Subject,
  Student,
  Admin,
  AttendanceRecord,
  Assignment,
  HomeworkSubmission,
  ExamResult,
  Exam,
} from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Teacher: {
    findOne: jest.fn(),
  },
  TeacherClassAssignment: {
    find: jest.fn(),
  },
  Class: {
    find: jest.fn(),
  },
  Subject: {
    find: jest.fn(),
  },
  Student: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Admin: {
    findOne: jest.fn(),
  },
  AttendanceRecord: {
    distinct: jest.fn(),
    aggregate: jest.fn(),
  },
  Assignment: {
    find: jest.fn(),
  },
  HomeworkSubmission: {
    countDocuments: jest.fn(),
  },
  ExamResult: {
    aggregate: jest.fn(),
    find: jest.fn(),
  },
  Exam: {
    find: jest.fn(),
  },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MTeacher = Teacher as unknown as { findOne: jest.Mock };
const MTeacherClassAssignment = TeacherClassAssignment as unknown as { find: jest.Mock };
const MClass = Class as unknown as { find: jest.Mock };
const MSubject = Subject as unknown as { find: jest.Mock };
const MStudent = Student as unknown as { find: jest.Mock; countDocuments: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };
const MAttendanceRecord = AttendanceRecord as unknown as { distinct: jest.Mock; aggregate: jest.Mock };
const MAssignment = Assignment as unknown as { find: jest.Mock };
const MHomeworkSubmission = HomeworkSubmission as unknown as { countDocuments: jest.Mock };
const MExamResult = ExamResult as unknown as { aggregate: jest.Mock; find: jest.Mock };
const MExam = Exam as unknown as { find: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const TEACHER_ID = "64a1b2c3d4e5f6a7b8c9dc01";
const TEACHER_STAFF_CODE = "TCH-001";

const OTHER_TEACHER_ID = "64a1b2c3d4e5f6a7b8c9dc02";
const OTHER_TEACHER_STAFF_CODE = "TCH-002";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9da01";

const STUDENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d030";
const PARENT_USER_ID = "64a1b2c3d4e5f6a7b8c9d040";
const COUNSELOR_USER_ID = "64a1b2c3d4e5f6a7b8c9d050";
const DRIVER_USER_ID = "64a1b2c3d4e5f6a7b8c9d060";

const CLASS_1_ID = "64a1b2c3d4e5f6a7b8c9c001";
const CLASS_2_ID = "64a1b2c3d4e5f6a7b8c9c002";
const UNASSIGNED_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c999";
const SUBJECT_1_ID = "64a1b2c3d4e5f6a7b8c9e001";

const OWN_TEACHER_DOC = {
  _id: TEACHER_ID,
  userId: TEACHER_USER_ID,
  schoolId: SCHOOL_A,
  staffCode: TEACHER_STAFF_CODE,
  firstName: "Asha",
  lastName: "Sharma",
  subjectSpecialization: "Mathematics",
  isActive: true,
};

const ADMIN_DOC = {
  _id: ADMIN_ID,
  userId: ADMIN_USER_ID,
  schoolId: SCHOOL_A,
  staffCode: "ADM-001",
  firstName: "Rajesh",
  lastName: "Mehta",
  isActive: true,
};

const ASSIGNED_CLASSES = [
  { _id: CLASS_1_ID, name: "Grade 10-A", schoolId: SCHOOL_A },
  { _id: CLASS_2_ID, name: "Grade 10-B", schoolId: SCHOOL_A },
];

const ASSIGNED_SUBJECTS = [
  { _id: SUBJECT_1_ID, name: "Mathematics", code: "MATH10", schoolId: SCHOOL_A },
];

const TEACHER_ASSIGNMENTS = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9a001",
    teacherId: TEACHER_ID,
    classId: CLASS_1_ID,
    subjectId: SUBJECT_1_ID,
    schoolId: SCHOOL_A,
    isActive: true,
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9a002",
    teacherId: TEACHER_ID,
    classId: CLASS_2_ID,
    subjectId: SUBJECT_1_ID,
    schoolId: SCHOOL_A,
    isActive: true,
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
  // Assignments, classes, subjects
  const asgLean = jest.fn().mockResolvedValue(TEACHER_ASSIGNMENTS);
  MTeacherClassAssignment.find.mockReturnValue({ lean: asgLean });

  const classLean = jest.fn().mockResolvedValue(ASSIGNED_CLASSES);
  MClass.find.mockReturnValue({ lean: classLean });

  const subjectLean = jest.fn().mockResolvedValue(ASSIGNED_SUBJECTS);
  MSubject.find.mockReturnValue({ lean: subjectLean });

  // Students
  MStudent.countDocuments.mockResolvedValue(55);
  const studentLean = jest.fn().mockResolvedValue([
    {
      _id: "64a1b2c3d4e5f6a7b8c9d091",
      firstName: "Rahul",
      lastName: "Sharma",
      studentCode: "STU-001",
      classId: CLASS_1_ID,
    },
    {
      _id: "64a1b2c3d4e5f6a7b8c9d092",
      firstName: "Priya",
      lastName: "Verma",
      studentCode: "STU-002",
      classId: CLASS_2_ID,
    },
  ]);
  const studentLimit = jest.fn().mockReturnValue({ lean: studentLean });
  MStudent.find.mockReturnValue({ limit: studentLimit });

  // Attendance
  MAttendanceRecord.distinct.mockResolvedValue([CLASS_1_ID]);
  MAttendanceRecord.aggregate.mockResolvedValue([
    { _id: "64a1b2c3d4e5f6a7b8c9d091", total: 20, present: 18 },
    { _id: "64a1b2c3d4e5f6a7b8c9d092", total: 20, present: 14 },
  ]);

  // Homework & Assignments
  const asgDocLean = jest.fn().mockResolvedValue([
    {
      _id: "asg_1",
      title: "Algebra Homework 1",
      subjectId: SUBJECT_1_ID,
      classId: CLASS_1_ID,
      dueDate: new Date(),
    },
  ]);
  const asgDocSelect = jest.fn().mockReturnValue({ lean: asgDocLean });
  MAssignment.find.mockReturnValue({ select: asgDocSelect });

  MHomeworkSubmission.countDocuments.mockResolvedValue(6);

  // ExamResults
  MExamResult.aggregate.mockResolvedValue([
    { _id: "64a1b2c3d4e5f6a7b8c9d091", avgScore: 22 },
    { _id: "64a1b2c3d4e5f6a7b8c9d092", avgScore: 12 },
  ]);
  const examResultLean = jest.fn().mockResolvedValue([{ marksObtained: 20 }]);
  const examResultSelect = jest.fn().mockReturnValue({ lean: examResultLean });
  MExamResult.find.mockReturnValue({ select: examResultSelect });

  // Exams
  const examLean = jest.fn().mockResolvedValue([
    {
      _id: "exam_1",
      subjectId: { name: "Mathematics" },
      classId: CLASS_1_ID,
      examDate: new Date("2026-10-15"),
    },
  ]);
  const examPopulate = jest.fn().mockReturnValue({ lean: examLean });
  const examLimit = jest.fn().mockReturnValue({ populate: examPopulate });
  const examSort = jest.fn().mockReturnValue({ limit: examLimit });
  MExam.find.mockReturnValue({ sort: examSort });
}

describe("GET /api/v1/teachers/[teacherId]/dashboard - Security Tests", () => {
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
  // A. AUTHENTICATION FAILURES
  // ==========================================
  describe("A. Authentication Failures", () => {
    it("1. Unauthenticated request returns 401", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("2. Malformed JWT returns 401", async () => {
      setCookieToken("invalid.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("3. Expired JWT returns 401", async () => {
      const token = await makeToken(
        { userId: TEACHER_USER_ID, role: "teacher", schoolId: SCHOOL_A },
        "-1s"
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("4. JWT signed with foreign secret returns 401", async () => {
      const token = await makeToken(
        { userId: TEACHER_USER_ID, role: "teacher", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_SECRET
      );
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // B. ROLE DENIAL (FAIL CLOSED)
  // ==========================================
  describe("B. Role Denial (Fail Closed)", () => {
    it("5. Student role is denied (403)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("6. Parent role is denied (403)", async () => {
      const token = await makeToken({
        userId: PARENT_USER_ID,
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("7. Counselor role is denied (403)", async () => {
      const token = await makeToken({
        userId: COUNSELOR_USER_ID,
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("8. Driver role is denied (403)", async () => {
      const token = await makeToken({
        userId: DRIVER_USER_ID,
        role: "driver" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("9. Unknown / guest role is denied (403)", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d099",
        role: "guest" as UserRole,
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // C. TEACHER AUTHORIZATION & SELF-ACCESS
  // ==========================================
  describe("C. Teacher Authorization & Self-Access", () => {
    it("10. Active teacher accessing own dashboard via 'me' succeeds (200)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEACHER_ID);
      expect(body.data.staffCode).toBe(TEACHER_STAFF_CODE);
      expect(body.data.name).toBe("Asha Sharma");

      expect(MTeacher.findOne).toHaveBeenCalledWith({
        userId: TEACHER_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("11. Active teacher accessing own dashboard via own staffCode succeeds (200)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${TEACHER_STAFF_CODE}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_STAFF_CODE }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEACHER_ID);
    });

    it("12. Teacher attempting to access another teacher's dashboard in same school returns 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${OTHER_TEACHER_ID}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: OTHER_TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("13. Teacher attempting to access another teacher's staffCode returns 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${OTHER_TEACHER_STAFF_CODE}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: OTHER_TEACHER_STAFF_CODE }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("14. Inactive teacher profile returns 403", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("14b. Teacher authenticated for School B cannot access dashboard (403)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_B,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).toHaveBeenCalledWith({
        userId: TEACHER_USER_ID,
        schoolId: SCHOOL_B,
        isActive: true,
      });
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // D. ADMIN AUTHORIZATION
  // ==========================================
  describe("D. Admin Authorization", () => {
    it("15. Active admin in same school can access specific teacher dashboard (200)", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(ADMIN_DOC));
      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${TEACHER_ID}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEACHER_ID);

      expect(MAdmin.findOne).toHaveBeenCalledWith({
        userId: ADMIN_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
      expect(MTeacher.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: TEACHER_ID,
          schoolId: SCHOOL_A,
          isActive: true,
        })
      );
    });

    it("16. Admin using 'me' or 'current' is denied (403)", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });

    it("17. Admin attempting to access teacher in another school returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(ADMIN_DOC));
      // Teacher not found in School A
      MTeacher.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${OTHER_TEACHER_ID}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: OTHER_TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("18. Inactive admin profile returns 403", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MAdmin.findOne.mockReturnValue(mockSelectLean(null));

      const req = new NextRequest(`http://localhost:3000/api/v1/teachers/${TEACHER_ID}/dashboard`);
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // E. TENANT ISOLATION & ASSIGNED-CLASS SCOPE
  // ==========================================
  describe("E. Tenant Isolation & Assigned-Class Scope", () => {
    it("19. All dashboard queries are strictly scoped to auth.schoolId", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });

      // Verify TeacherClassAssignment scoped to schoolId
      expect(MTeacherClassAssignment.find).toHaveBeenCalledWith({
        teacherId: TEACHER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });

      // Verify Student query scoped to schoolId
      expect(MStudent.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A, isActive: true })
      );
      expect(MStudent.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A, isActive: true }),
        expect.any(Object)
      );

      // Verify Attendance distinct scoped to schoolId
      expect(MAttendanceRecord.distinct).toHaveBeenCalledWith(
        "classId",
        expect.objectContaining({ schoolId: SCHOOL_A })
      );

      // Verify Assignment scoped to schoolId
      expect(MAssignment.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );

      // Verify Exam scoped to schoolId
      expect(MExam.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
    });

    it("20. Requesting an unassigned class via ?classId= returns 403 Forbidden", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/me/dashboard?classId=${UNASSIGNED_CLASS_ID}`
      );
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("21. Requesting a valid assigned class via ?classId= filters metrics to that class (200)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/me/dashboard?classId=${CLASS_1_ID}`
      );
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Student count filtered to CLASS_1_ID only
      expect(MStudent.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: { $in: [expect.anything()] },
          schoolId: SCHOOL_A,
        })
      );
    });
  });

  // ==========================================
  // F. SPOOFING IMMUNITY & QUERY GATING
  // ==========================================
  describe("F. Spoofing Immunity & Query Gating", () => {
    it("22. Forged x-user-role cannot elevate student to teacher (403)", async () => {
      const token = await makeToken({
        userId: STUDENT_USER_ID,
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard", {
        headers: {
          "x-user-role": "teacher",
          "x-user-id": TEACHER_USER_ID,
        },
      });
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("23. Forged ?role=admin cannot elevate teacher to admin (403 when accessing another teacher)", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${OTHER_TEACHER_ID}/dashboard?role=admin`
      );
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: OTHER_TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MAdmin.findOne).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // G. DATA MINIMIZATION & FUNCTIONAL CONTRACT
  // ==========================================
  describe("G. Data Minimization & Functional Contract", () => {
    it("24. Dashboard response shape matches contract and does not expose sensitive PII", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));
      setupSuccessfulDashboardMocks();

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const d = body.data;
      expect(d.id).toBe(TEACHER_ID);
      expect(d.name).toBe("Asha Sharma");
      expect(d.staffCode).toBe(TEACHER_STAFF_CODE);
      expect(d.role).toBe("Mathematics Teacher");
      expect(d.academicYear).toBe("2026–27");

      expect(d.metrics).toEqual({
        totalStudents: 55,
        attendancePending: 1, // CLASS_2 is pending
        homeworkPendingReview: 6,
        studentsRequiringAttention: 1, // Student 2 has score 48% (<60%)
      });

      expect(Array.isArray(d.classesToday)).toBe(true);
      expect(Array.isArray(d.attendanceTasks)).toBe(true);
      expect(Array.isArray(d.studentsRequiringAttention)).toBe(true);
      expect(Array.isArray(d.homeworkReview)).toBe(true);
      expect(Array.isArray(d.upcomingExams)).toBe(true);
      expect(Array.isArray(d.assignedClasses)).toBe(true);

      // Verify data minimization: student objects in studentsRequiringAttention don't have sensitive PII
      d.studentsRequiringAttention.forEach((s: Record<string, unknown>) => {
        expect(s).not.toHaveProperty("dateOfBirth");
        expect(s).not.toHaveProperty("address");
        expect(s).not.toHaveProperty("emergencyContact");
        expect(s).not.toHaveProperty("medicalInfo");
        expect(s).not.toHaveProperty("notes");
      });
    });

    it("25. Teacher with zero assigned classes receives graceful empty dashboard", async () => {
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      MTeacher.findOne.mockReturnValue(mockSelectLean(OWN_TEACHER_DOC));

      // Zero assignments
      const asgLean = jest.fn().mockResolvedValue([]);
      MTeacherClassAssignment.find.mockReturnValue({ lean: asgLean });

      const classLean = jest.fn().mockResolvedValue([]);
      MClass.find.mockReturnValue({ lean: classLean });

      const subjectLean = jest.fn().mockResolvedValue([]);
      MSubject.find.mockReturnValue({ lean: subjectLean });

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/dashboard");
      const res = await getTeacherDashboardRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.metrics.totalStudents).toBe(0);
      expect(body.data.assignedClasses).toEqual([]);
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });
  });
});
