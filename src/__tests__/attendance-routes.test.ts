/**
 * Tests for JWT-protected POST /api/v1/attendance
 * - No/invalid/expired JWT -> 401
 * - Non-teacher roles -> 403
 * - Teacher identity from auth.userId (never body.teacherId)
 * - Forged x-user-id / x-user-role cannot bypass JWT
 * - Assignment + student membership (school/class) enforcement
 * - Successful writes use auth.userId as recordedBy / auth.schoolId as schoolId
 */

import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { POST as markAttendance } from "@/app/api/v1/attendance/route";

// Mock next/headers (used by requireAuth -> getAuthContext)
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// Mock database connection
jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

// Mock TeacherService
jest.mock("@/services/teacher.service", () => ({
  TeacherService: {
    resolveTeacherByUserId: jest.fn(),
    verifyAssignment: jest.fn(),
  },
}));

// Mock models used by the route
jest.mock("@/models", () => ({
  AttendanceRecord: { findOneAndUpdate: jest.fn() },
  Student: { findOne: jest.fn() },
}));

import { cookies } from "next/headers";
import { TeacherService } from "@/services/teacher.service";
import { AttendanceRecord, Student } from "@/models";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockTeacherService = TeacherService as unknown as jest.Mocked<typeof TeacherService>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAttendanceRecord = AttendanceRecord as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStudent = Student as any;

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";

// Authenticated teacher context (JWT payload) - the ONLY trusted identity
const AUTH = {
  userId: "64a1b2c3d4e5f6a7b8c9d0e1",
  role: "teacher" as const,
  schoolId: "64a1b2c3d4e5f6a7b8c9d0e0",
};

// Teacher profile resolved from JWT identity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEACHER: any = {
  _id: "64a1b2c3d4e5f6a7b8c9d0f1",
  userId: AUTH.userId,
  schoolId: AUTH.schoolId,
  staffCode: "STF-101",
  firstName: "Asha",
  lastName: "Sharma",
  isActive: true,
};

const CLASS_ID = "64a1b2c3d4e5f6a7b8c9d0f2";
const STUDENT_ID = "64a1b2c3d4e5f6a7b8c9d0f3";
const OTHER_TEACHER_ID = "64a1b2c3d4e5f6a7b8c9d0f4";

const RECORD = {
  _id: "64a1b2c3d4e5f6a7b8c9d0f5",
  studentId: STUDENT_ID,
  classId: CLASS_ID,
  date: new Date(),
  status: "present",
  recordedBy: AUTH.userId,
  schoolId: AUTH.schoolId,
};

// Helper to create mock cookie store
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

function createValidRequest(body: unknown, headers?: Record<string, string>) {
  const url = "http://localhost:3000/api/v1/attendance";
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createValidBody(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS_ID,
    studentId: STUDENT_ID,
    status: "present",
    ...overrides,
  };
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

describe("POST /api/v1/attendance [auth]", () => {
  describe("authentication failures (401)", () => {
    it("should return 401 when no access_token cookie is present", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("UNAUTHORIZED");
      expect(mockTeacherService.resolveTeacherByUserId).not.toHaveBeenCalled();
    });

    it("should return 401 when the JWT is invalid", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore("invalid-jwt-token"));

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when the JWT is expired", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(TEST_SECRET);
      const now = Math.floor(Date.now() / 1000);

      const expiredToken = await new SignJWT({
        userId: AUTH.userId,
        role: "teacher",
        schoolId: AUTH.schoolId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 1000)
        .setExpirationTime(now - 500)
        .sign(secret);

      mockCookies.mockResolvedValue(createMockCookieStore(expiredToken));

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("authorization failures (403 - non-teacher roles)", () => {
    it.each([
      ["student", "64a1b2c3d4e5f6a7b8c9d0e1"],
      ["parent", "64a1b2c3d4e5f6a7b8c9d0e2"],
      ["counselor", "64a1b2c3d4e5f6a7b8c9d0e3"],
      ["admin", "64a1b2c3d4e5f6a7b8c9d0e4"],
    ])("should return 403 for %s JWT", async (role, userId) => {
      const token = await signAccessToken({
        userId,
        role: role as "student" | "parent" | "counselor" | "admin",
        schoolId: AUTH.schoolId,
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("FORBIDDEN");
      expect(mockTeacherService.resolveTeacherByUserId).not.toHaveBeenCalled();
    });
  });

  describe("forged headers cannot bypass authentication", () => {
    it("should return 401 for forged x-user-id + x-user-role without JWT", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(undefined));

      const response = await markAttendance(
        createValidRequest(createValidBody(), {
          "x-user-id": "forged-user-id",
          "x-user-role": "teacher",
        })
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
      expect(mockTeacherService.resolveTeacherByUserId).not.toHaveBeenCalled();
    });

    it("should return 403 for forged x-user-role with non-teacher JWT", async () => {
      const token = await signAccessToken({
        userId: "64a1b2c3d4e5f6a7b8c9d0e2",
        role: "student",
        schoolId: AUTH.schoolId,
      });
      mockCookies.mockResolvedValue(createMockCookieStore(token));

      const response = await markAttendance(
        createValidRequest(createValidBody(), { "x-user-role": "teacher" })
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });
});

describe("POST /api/v1/attendance [identity and assignment]", () => {
  describe("teacher identity comes from JWT, not the client", () => {
    it("should resolve teacher using auth.userId and auth.schoolId", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTeacherService.verifyAssignment.mockResolvedValue({ _id: "a1" } as any);
      mockStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: STUDENT_ID }) }),
      });
      mockAttendanceRecord.findOneAndUpdate.mockResolvedValue(RECORD);

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockTeacherService.resolveTeacherByUserId).toHaveBeenCalledWith(
        AUTH.userId,
        AUTH.schoolId
      );
    });

    it("body teacherId for another teacher cannot override JWT identity", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTeacherService.verifyAssignment.mockResolvedValue({ _id: "a1" } as any);
      mockStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: STUDENT_ID }) }),
      });
      mockAttendanceRecord.findOneAndUpdate.mockResolvedValue(RECORD);

      // Body claims a DIFFERENT teacher - must be ignored.
      const response = await markAttendance(
        createValidRequest(createValidBody({ teacherId: OTHER_TEACHER_ID }))
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockTeacherService.resolveTeacherByUserId).toHaveBeenCalledWith(
        AUTH.userId,
        AUTH.schoolId
      );
      expect(mockTeacherService.resolveTeacherByUserId).not.toHaveBeenCalledWith(
        OTHER_TEACHER_ID,
        expect.anything()
      );
      expect(mockAttendanceRecord.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          recordedBy: AUTH.userId,
          schoolId: AUTH.schoolId,
        }),
        expect.any(Object)
      );
    });
  });

  describe("assignment authorization", () => {
    it("should return 403 when teacher is not assigned to the class", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);

      const { APIError } = await import("@/lib/api-error");
      mockTeacherService.verifyAssignment.mockRejectedValue(
        APIError.forbidden("You are not assigned to this class/subject. Write operation denied.")
      );

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
      expect(mockStudent.findOne).not.toHaveBeenCalled();
      expect(mockAttendanceRecord.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/v1/attendance [student and write]", () => {
  describe("student membership validation", () => {
    it("should reject a student from another school", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTeacherService.verifyAssignment.mockResolvedValue({ _id: "a1" } as any);
      mockStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(mockAttendanceRecord.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("should reject a student that does not belong to the requested class", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTeacherService.verifyAssignment.mockResolvedValue({ _id: "a1" } as any);
      mockStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
      // Student lookup scoped to auth.schoolId AND classId
      expect(mockStudent.findOne).toHaveBeenCalledWith({
        _id: STUDENT_ID,
        schoolId: AUTH.schoolId,
        classId: CLASS_ID,
        isActive: true,
      });
    });
  });

  describe("successful write uses JWT identity", () => {
    it("should write recordedBy = auth.userId and schoolId = auth.schoolId", async () => {
      mockCookies.mockResolvedValue(createMockCookieStore(await signAccessToken(AUTH)));
      mockTeacherService.resolveTeacherByUserId.mockResolvedValue(TEACHER);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTeacherService.verifyAssignment.mockResolvedValue({ _id: "a1" } as any);
      mockStudent.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: STUDENT_ID }) }),
      });
      mockAttendanceRecord.findOneAndUpdate.mockResolvedValue(RECORD);

      const response = await markAttendance(createValidRequest(createValidBody()));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // Upsert scoped to auth.schoolId and stamped with recordedBy=auth.userId
      expect(mockAttendanceRecord.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          schoolId: AUTH.schoolId,
        }),
        expect.objectContaining({
          recordedBy: AUTH.userId,
          schoolId: AUTH.schoolId,
        }),
        expect.objectContaining({ upsert: true, new: true })
      );
    });
  });
});
