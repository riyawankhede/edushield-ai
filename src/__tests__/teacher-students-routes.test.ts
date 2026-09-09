/**
 * Security and Authorization Tests for GET /api/v1/teachers/[teacherId]/students
 *
 * Phase 2J CRIT-3 Security Hardening:
 * 1. Unauthenticated request -> 401
 * 2. Invalid / malformed / expired token -> 401
 * 3. Student role -> 403
 * 4. Parent role -> 403
 * 5. Counselor role -> 403
 * 6. Unknown / invalid role -> 403
 * 7. Teacher accessing own student directory -> allowed (200)
 * 8. Teacher resolved from authenticated userId, not request headers (anti-spoofing)
 * 9. Teacher accessing another teacher in same school -> denied (403)
 * 10. Teacher accessing another school's teacher -> denied (403)
 * 11. "me" resolves to authenticated teacher only
 * 12. No first-teacher / global fallback
 * 13. Inactive teacher -> denied (403)
 * 14. Teacher sees only students from assigned classes
 * 15. Teacher does not see students from unassigned classes (class filtering / scoping)
 * 16. Cross-school students cannot leak (tenant isolation via auth.schoolId)
 * 17. Admin behavior matches AUTHORIZATION_MATRIX.md (same-school admin allowed for specific teacher; "me" rejected)
 * 18. Unauthorized requests perform no student-directory query (query gating)
 * 19. Response shape remains compatible ({ success: true, data: [...], meta: { ... } })
 * 20. Sensitive/unnecessary PII is not exposed (no dateOfBirth, address, emergencyContact)
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { GET as getTeacherStudentsRoute } from "@/app/api/v1/teachers/[teacherId]/students/route";
import {
  Teacher,
  TeacherClassAssignment,
  Class,
  Subject,
  Student,
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
  Teacher: {
    findOne: jest.fn(),
  },
  TeacherClassAssignment: {
    find: jest.fn(),
    findOne: jest.fn(),
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
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

const MTeacher = Teacher as unknown as { findOne: jest.Mock };
const MTeacherClassAssignment = TeacherClassAssignment as unknown as {
  find: jest.Mock;
  findOne: jest.Mock;
};
const MClass = Class as unknown as { find: jest.Mock };
const MSubject = Subject as unknown as { find: jest.Mock };
const MStudent = Student as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d001";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d002";

const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d010";
const TEACHER_ID = "64a1b2c3d4e5f6a7b8c9dc01";
const TEACHER_STAFF_CODE = "TCH-001";

const OTHER_TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d011";
const OTHER_TEACHER_ID = "64a1b2c3d4e5f6a7b8c9dc02";
const OTHER_TEACHER_STAFF_CODE = "TCH-002";

const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d020";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9da01";

const CLASS_1_ID = "64a1b2c3d4e5f6a7b8c9c001";
const CLASS_2_ID = "64a1b2c3d4e5f6a7b8c9c002";
const UNASSIGNED_CLASS_ID = "64a1b2c3d4e5f6a7b8c9c999";

const SUBJECT_1_ID = "64a1b2c3d4e5f6a7b8c9s001";

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

const OTHER_TEACHER_DOC = {
  _id: OTHER_TEACHER_ID,
  userId: OTHER_TEACHER_USER_ID,
  schoolId: SCHOOL_A,
  staffCode: OTHER_TEACHER_STAFF_CODE,
  firstName: "Ravi",
  lastName: "Patel",
  subjectSpecialization: "Science",
  isActive: true,
};

const ADMIN_DOC = {
  _id: ADMIN_ID,
  userId: ADMIN_USER_ID,
  schoolId: SCHOOL_A,
  role: "admin",
  isActive: true,
};

const ASSIGNMENTS_DOCS = [
  {
    _id: "asg_1",
    teacherId: TEACHER_ID,
    classId: CLASS_1_ID,
    subjectId: SUBJECT_1_ID,
    schoolId: SCHOOL_A,
    isActive: true,
  },
  {
    _id: "asg_2",
    teacherId: TEACHER_ID,
    classId: CLASS_2_ID,
    subjectId: SUBJECT_1_ID,
    schoolId: SCHOOL_A,
    isActive: true,
  },
];

const CLASSES_DOCS = [
  { _id: CLASS_1_ID, name: "Grade 10-A", schoolId: SCHOOL_A },
  { _id: CLASS_2_ID, name: "Grade 10-B", schoolId: SCHOOL_A },
];

const SUBJECTS_DOCS = [
  { _id: SUBJECT_1_ID, name: "Mathematics", schoolId: SCHOOL_A },
];

const SAFE_STUDENTS_DOCS = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9e001",
    studentCode: "STU-001",
    firstName: "Aarav",
    lastName: "Kumar",
    gender: "male",
    grade: "10",
    section: "A",
    classId: CLASS_1_ID,
    enrollmentDate: new Date("2025-06-01"),
    isActive: true,
    profileImageUrl: "https://example.com/aarav.jpg",
    schoolId: SCHOOL_A,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-06-01"),
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9e002",
    studentCode: "STU-002",
    firstName: "Diya",
    lastName: "Patel",
    gender: "female",
    grade: "10",
    section: "B",
    classId: CLASS_2_ID,
    enrollmentDate: new Date("2025-06-01"),
    isActive: true,
    profileImageUrl: "https://example.com/diya.jpg",
    schoolId: SCHOOL_A,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-06-01"),
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

function setupSuccessfulTeacherMocks(options?: {
  students?: typeof SAFE_STUDENTS_DOCS;
  assignments?: typeof ASSIGNMENTS_DOCS;
  classes?: typeof CLASSES_DOCS;
  subjects?: typeof SUBJECTS_DOCS;
}) {
  const studentsToReturn = options?.students ?? SAFE_STUDENTS_DOCS;
  const assignmentsToReturn = options?.assignments ?? ASSIGNMENTS_DOCS;
  const classesToReturn = options?.classes ?? CLASSES_DOCS;
  const subjectsToReturn = options?.subjects ?? SUBJECTS_DOCS;

  // Teacher lookup
  MTeacher.findOne.mockImplementation((query: Record<string, unknown>) => {
    if (query.userId === TEACHER_USER_ID && query.schoolId === SCHOOL_A && query.isActive === true) {
      return { lean: jest.fn().mockResolvedValue(OWN_TEACHER_DOC) };
    }
    if (
      (query._id === TEACHER_ID || query.staffCode === TEACHER_STAFF_CODE) &&
      query.schoolId === SCHOOL_A &&
      query.isActive === true
    ) {
      return { lean: jest.fn().mockResolvedValue(OWN_TEACHER_DOC) };
    }
    if (
      (query._id === OTHER_TEACHER_ID || query.staffCode === OTHER_TEACHER_STAFF_CODE) &&
      query.schoolId === SCHOOL_A &&
      query.isActive === true
    ) {
      return { lean: jest.fn().mockResolvedValue(OTHER_TEACHER_DOC) };
    }
    return { lean: jest.fn().mockResolvedValue(null) };
  });

  // Assignments lookup
  MTeacherClassAssignment.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(assignmentsToReturn),
  });

  // Classes & Subjects lookup
  MClass.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(classesToReturn),
  });
  MSubject.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(subjectsToReturn),
  });

  // Student query chaining
  const studentLean = jest.fn().mockResolvedValue(studentsToReturn);
  const studentLimit = jest.fn().mockReturnValue({ lean: studentLean });
  const studentSkip = jest.fn().mockReturnValue({ limit: studentLimit });
  const studentSort = jest.fn().mockReturnValue({ skip: studentSkip });
  const studentSelect = jest.fn().mockReturnValue({ sort: studentSort });
  MStudent.find.mockReturnValue({ select: studentSelect });

  MStudent.countDocuments.mockResolvedValue(studentsToReturn.length);
}

describe("GET /api/v1/teachers/[teacherId]/students - Security Tests", () => {
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
  // 1 & 2: AUTHENTICATION
  // ==========================================
  describe("1 & 2. Authentication", () => {
    it("1. Unauthenticated request (no cookie) returns 401", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("2a. Malformed JWT returns 401", async () => {
      setCookieToken("invalid.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("2b. Expired JWT returns 401", async () => {
      const expiredToken = await makeToken(
        { userId: TEACHER_USER_ID, role: "teacher", schoolId: SCHOOL_A },
        "-5m"
      );
      setCookieToken(expiredToken);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("2c. JWT signed with foreign secret returns 401", async () => {
      const foreignToken = await makeToken(
        { userId: TEACHER_USER_ID, role: "teacher", schoolId: SCHOOL_A },
        "15m",
        FOREIGN_SECRET
      );
      setCookieToken(foreignToken);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3-6: ROLE AUTHORIZATION (FAIL CLOSED)
  // ==========================================
  describe("3-6. Role Authorization & Fail Closed", () => {
    it("3. Student role returns 403", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d030",
        role: "student",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("4. Parent role returns 403", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d040",
        role: "parent",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("5. Counselor role returns 403", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d050",
        role: "counselor",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("6. Unknown/invalid role returns 403", async () => {
      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d060",
        role: "guest",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MTeacher.findOne).not.toHaveBeenCalled();
      expect(MStudent.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 7-13: TEACHER IDENTITY & SELF-ONLY AUTHORIZATION
  // ==========================================
  describe("7-13. Teacher Identity Binding & Scope", () => {
    it("7. Teacher accessing own student directory via 'me' returns 200", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it("7b. Teacher accessing own directory via own ObjectId returns 200", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${TEACHER_ID}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("7c. Teacher accessing own directory via own staffCode returns 200", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${TEACHER_STAFF_CODE}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_STAFF_CODE }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("8. Teacher identity is resolved from authenticated userId, ignoring spoofed headers", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${TEACHER_ID}/students`,
        {
          headers: {
            "x-user-role": "admin",
            "x-user-id": OTHER_TEACHER_USER_ID,
          },
        }
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MTeacher.findOne).toHaveBeenCalledWith({
        userId: TEACHER_USER_ID,
        schoolId: SCHOOL_A,
        isActive: true,
      });
    });

    it("9. Teacher accessing another teacher in same school returns 403", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${OTHER_TEACHER_ID}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: OTHER_TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("10. Teacher accessing another school's teacher returns 403", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const foreignTeacherId = "64a1b2c3d4e5f6a7b8c9dc99";
      MTeacher.findOne.mockImplementation((query: Record<string, unknown>) => {
        if (query.userId === TEACHER_USER_ID && query.schoolId === SCHOOL_A) {
          return { lean: jest.fn().mockResolvedValue(OWN_TEACHER_DOC) };
        }
        if (query._id === foreignTeacherId && query.schoolId === SCHOOL_B) {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: foreignTeacherId,
              schoolId: SCHOOL_B,
              staffCode: "TCH-999",
              isActive: true,
            }),
          };
        }
        return { lean: jest.fn().mockResolvedValue(null) };
      });

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${foreignTeacherId}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: foreignTeacherId }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("11 & 12. 'me' resolves strictly to authenticated teacher and never falls back to first teacher", async () => {
      // Mock returns null for the authenticated user lookup
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const token = await makeToken({
        userId: "64a1b2c3d4e5f6a7b8c9d999",
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      // Verify no global query without userId was performed
      expect(MTeacher.findOne).toHaveBeenCalledWith({
        userId: "64a1b2c3d4e5f6a7b8c9d999",
        schoolId: SCHOOL_A,
        isActive: true,
      });
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("13. Inactive teacher profile returns 403", async () => {
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null), // resolveTeacherByUserId queries { isActive: true }
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 14-16: ASSIGNMENT SCOPE & TENANT ISOLATION
  // ==========================================
  describe("14-16. Assignment-Based Access & Tenant Isolation", () => {
    it("14. Teacher sees only students from assigned classes", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify Student query was scoped to assigned classes and schoolId
      expect(MStudent.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isActive: true,
          classId: {
            $in: expect.arrayContaining([
              expect.anything(),
              expect.anything(),
            ]),
          },
        })
      );
    });

    it("15a. When teacher has no assigned classes, returns empty array without student query", async () => {
      setupSuccessfulTeacherMocks({
        assignments: [],
        classes: [],
        subjects: [],
        students: [],
      });

      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("15b. Requesting an unassigned classId filter returns empty list without student query", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/me/students?classId=${UNASSIGNED_CLASS_ID}`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("15c. Requesting a valid assigned classId filter queries only that class", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/me/students?classId=${CLASS_1_ID}`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(MStudent.find).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A,
          isActive: true,
        })
      );
    });

    it("16. Cross-school students cannot leak: queries enforce auth.schoolId", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });

      // Verify schoolId isolation across all relevant model calls
      expect(MTeacherClassAssignment.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MClass.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
      expect(MStudent.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: SCHOOL_A })
      );
    });
  });

  // ==========================================
  // 17: ADMIN ACCESS (AUTHORIZATION MATRIX)
  // ==========================================
  describe("17. Admin Access According to Authorization Matrix", () => {
    beforeEach(() => {
      MAdmin.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(ADMIN_DOC),
        }),
        lean: jest.fn().mockResolvedValue(ADMIN_DOC),
      });
    });

    it("17a. Admin accessing specific teacher in same school is allowed", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${TEACHER_ID}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
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

    it("17b. Admin accessing with 'me' is rejected (403)", async () => {
      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("17c. Admin accessing teacher from another school returns 403", async () => {
      // Teacher not found in same school
      MTeacher.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const foreignTeacherId = "64a1b2c3d4e5f6a7b8c9dc99";
      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${foreignTeacherId}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: foreignTeacherId }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });

    it("17d. Inactive admin profile returns 403", async () => {
      MAdmin.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
        lean: jest.fn().mockResolvedValue(null),
      });

      const token = await makeToken({
        userId: ADMIN_USER_ID,
        role: "admin",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/teachers/${TEACHER_ID}/students`
      );
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: TEACHER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(MStudent.find).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 18-20: QUERY GATING, RESPONSE SHAPE, PII MINIMIZATION
  // ==========================================
  describe("18-20. Query Gating, Response Shape & PII Minimization", () => {
    it("18. Unauthorized requests perform no student-directory query", async () => {
      setCookieToken(undefined);
      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });

      expect(MStudent.find).not.toHaveBeenCalled();
      expect(MStudent.countDocuments).not.toHaveBeenCalled();
    });

    it("19. Response shape remains compatible with existing client expectations", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("page", 1);
      expect(body.meta).toHaveProperty("pageSize", 20);
      expect(body.meta).toHaveProperty("total", 2);
      expect(body.meta).toHaveProperty("totalPages", 1);

      // Enriched with className
      expect(body.data[0]).toHaveProperty("className", "Grade 10-A");
      expect(body.data[1]).toHaveProperty("className", "Grade 10-B");
    });

    it("20. Sensitive PII fields are not exposed in returned student data", async () => {
      setupSuccessfulTeacherMocks();
      const token = await makeToken({
        userId: TEACHER_USER_ID,
        role: "teacher",
        schoolId: SCHOOL_A,
      });
      setCookieToken(token);

      const req = new NextRequest("http://localhost:3000/api/v1/teachers/me/students");
      const res = await getTeacherStudentsRoute(req, {
        params: Promise.resolve({ teacherId: "me" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      for (const student of body.data) {
        expect(student).not.toHaveProperty("dateOfBirth");
        expect(student).not.toHaveProperty("address");
        expect(student).not.toHaveProperty("emergencyContact");
        expect(student).not.toHaveProperty("medicalInfo");
        expect(student).not.toHaveProperty("notes");
        expect(student).not.toHaveProperty("passwordHash");
      }

      // Verify that MStudent.find used strict projection
      const selectCall = MStudent.find().select;
      expect(selectCall).toHaveBeenCalledWith(
        "_id studentCode firstName lastName gender grade section classId enrollmentDate isActive profileImageUrl schoolId createdAt updatedAt"
      );
    });
  });
});
