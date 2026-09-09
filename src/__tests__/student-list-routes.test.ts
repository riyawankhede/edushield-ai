/**
 * Tests for JWT-protected GET /api/v1/students
 *
 * STEP 2I — SECURE GET /api/v1/students
 *
 * Verifies:
 * 1. Missing JWT -> 401
 * 2. Malformed JWT -> 401
 * 3. Expired JWT -> 401
 * 4. Foreign-secret JWT -> 401
 * 5. Student JWT -> 403
 * 6. Parent JWT -> 403
 * 7. Teacher JWT -> 403
 * 8. Counselor JWT -> 403
 * 9. Unknown role -> 403
 * 10. Admin from School A cannot access School B students (tenant isolation)
 * 11. Inactive admin profile -> 403
 * 12. Active admin from School A -> 200
 * 13. Forged x-user-id header is ignored
 * 14. Forged x-user-role header is ignored
 * 15. DB queries are not executed when authentication/authorization fails
 * 16. Pagination is preserved
 * 17. pageSize remains bounded to the existing maximum (100)
 * 18. grade filter works
 * 19. section filter works
 * 20. search works
 * 21. regex metacharacters in search are safely escaped
 * 22. returned records do not expose the removed sensitive PII fields
 * 23. countDocuments is also school-scoped
 */

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { signAccessToken } from "@/lib/jwt";
import { GET as getStudentDirectory } from "@/app/api/v1/students/route";
import { Student, Admin } from "@/models";
import type { UserRole } from "@/types/identity";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(),
}));

jest.mock("@/models", () => ({
  Student: { find: jest.fn(), countDocuments: jest.fn() },
  Admin: { findOne: jest.fn() },
}));

import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const MStudent = Student as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const MAdmin = Admin as unknown as { findOne: jest.Mock };

const TEST_SECRET = "test-secret-that-is-long-enough-32chars!";
const FOREIGN_TEST_SECRET = "foreign-secret-that-is-long-enough-32!";

const SCHOOL_A = "64a1b2c3d4e5f6a7b8c9d0e0";
const SCHOOL_B = "64a1b2c3d4e5f6a7b8c9d0e1";
const ADMIN_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const ADMIN_ID = "64a1b2c3d4e5f6a7b8c9d0d1";

const SCHOOL_A_STUDENTS = [
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0f1",
    userId: "64a1b2c3d4e5f6a7b8c9d0f2",
    schoolId: SCHOOL_A,
    studentCode: "STU-001",
    firstName: "Aarav",
    lastName: "Verma",
    gender: "male",
    grade: "10",
    section: "A",
    classId: "64a1b2c3d4e5f6a7b8c9d0c1",
    enrollmentDate: new Date("2025-04-01"),
    isActive: true,
    profileImageUrl: "/profiles/aarav.png",
    createdAt: new Date("2025-04-01"),
    updatedAt: new Date("2025-04-01"),
    // Sensitive PII that must be excluded:
    dateOfBirth: new Date("2010-05-15"),
    address: {
      street: "123 Main St",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110001",
    },
    emergencyContact: {
      name: "Rajesh Verma",
      phone: "+91-9876543210",
      relationship: "father",
    },
  },
  {
    _id: "64a1b2c3d4e5f6a7b8c9d0f3",
    userId: "64a1b2c3d4e5f6a7b8c9d0f4",
    schoolId: SCHOOL_A,
    studentCode: "STU-002",
    firstName: "Diya",
    lastName: "Sharma",
    gender: "female",
    grade: "10",
    section: "B",
    classId: "64a1b2c3d4e5f6a7b8c9d0c2",
    enrollmentDate: new Date("2025-04-01"),
    isActive: true,
    profileImageUrl: "/profiles/diya.png",
    createdAt: new Date("2025-04-01"),
    updatedAt: new Date("2025-04-01"),
    dateOfBirth: new Date("2010-08-20"),
    address: {
      street: "456 Park Ave",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110002",
    },
    emergencyContact: {
      name: "Anil Sharma",
      phone: "+91-9876543211",
      relationship: "father",
    },
  },
];

interface StudentFindChain {
  select: jest.Mock;
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  lean: jest.Mock;
}

let studentFindChain: StudentFindChain;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (value: unknown): any => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  lean: jest.fn().mockResolvedValue(value),
});

function studentList(value: unknown[]): StudentFindChain {
  const chain: StudentFindChain = {
    select: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn().mockResolvedValue(value),
  };

  chain.select.mockImplementation((projectionStr: string) => {
    const fields = projectionStr.split(" ");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = value.map((doc: any) => {
      const result: Record<string, unknown> = {};
      fields.forEach((f) => {
        if (f in doc) result[f] = doc[f];
      });
      return result;
    });
    chain.lean.mockResolvedValue(sanitized);
    return chain;
  });

  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

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

function createRequest(
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost:3000/api/v1/students");
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url, { method: "GET", headers });
}

async function callRoute(
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
) {
  const response = await getStudentDirectory(createRequest(queryParams, headers));
  return { response, body: await response.json() };
}

async function tokenFor(
  role: UserRole | string,
  userId = ADMIN_USER_ID,
  schoolId = SCHOOL_A
): Promise<string> {
  return signAccessToken({ userId, role: role as UserRole, schoolId });
}

async function signedTokenWithSecret(
  secret: string,
  expiration: string | number
): Promise<string> {
  return new SignJWT({
    userId: ADMIN_USER_ID,
    role: "admin",
    schoolId: SCHOOL_A,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret));
}

function setupAdminProfile(active = true, schoolId = SCHOOL_A): void {
  MAdmin.findOne.mockImplementation((filter?: Record<string, unknown>) => {
    if (!filter) return one(null);
    if (filter.userId === ADMIN_USER_ID && filter.schoolId === schoolId && filter.isActive === active) {
      return one({ _id: ADMIN_ID, userId: ADMIN_USER_ID, schoolId, isActive: active });
    }
    return one(null);
  });
}

function expectNoDatabaseQueries(): void {
  expect(MStudent.find).not.toHaveBeenCalled();
  expect(MStudent.countDocuments).not.toHaveBeenCalled();
}

describe("GET /api/v1/students - Security Tests", () => {
  beforeAll(() => {
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    studentFindChain = studentList(SCHOOL_A_STUDENTS);
    MStudent.find.mockReturnValue(studentFindChain);
    MStudent.countDocuments.mockResolvedValue(SCHOOL_A_STUDENTS.length);
    setupAdminProfile(true);
  });

  // 1. Missing JWT -> 401
  it("1. Missing JWT returns 401 and does not execute database queries", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoDatabaseQueries();
  });

  // 2. Malformed JWT -> 401
  it("2. Malformed JWT returns 401 and does not execute database queries", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore("not-a-valid-jwt"));
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoDatabaseQueries();
  });

  // 3. Expired JWT -> 401
  it("3. Expired JWT returns 401 and does not execute database queries", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(TEST_SECRET, -10))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoDatabaseQueries();
  });

  // 4. Foreign-secret JWT -> 401
  it("4. Foreign-secret signed JWT returns 401 and does not execute database queries", async () => {
    mockCookies.mockResolvedValue(
      createMockCookieStore(await signedTokenWithSecret(FOREIGN_TEST_SECRET, "15m"))
    );
    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expectNoDatabaseQueries();
  });

  // 5. Student JWT -> 403
  it("5. Student JWT returns 403 and does not query student records", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 6. Parent JWT -> 403
  it("6. Parent JWT returns 403 and does not query student records", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 7. Teacher JWT -> 403
  it("7. Teacher JWT returns 403 and does not query student records", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("teacher")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 8. Counselor JWT -> 403
  it("8. Counselor JWT returns 403 and does not query student records", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("counselor")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 9. Unknown role -> 403
  it("9. Unknown role returns 403 and does not query student records", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("superadmin")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 10. Admin from School A cannot access School B students
  it("10. Admin from School A has queries strictly scoped to School A; School B students are not accessible", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_A)));
    const { response } = await callRoute();

    expect(response.status).toBe(200);
    expect(MStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
      })
    );
    expect(MStudent.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
      })
    );
  });

  // 11. Inactive admin profile -> 403
  it("11. Inactive admin profile returns 403 and does not return students", async () => {
    setupAdminProfile(false);
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expectNoDatabaseQueries();
  });

  // 12. Active admin from School A -> 200
  it("12. Active admin from School A returns 200 with student directory and pagination", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
  });

  // 13. Forged x-user-id header is ignored
  it("13. Forged x-user-id header cannot bypass missing or invalid token", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    const { response } = await callRoute(undefined, {
      "x-user-id": ADMIN_USER_ID,
      "x-user-role": "admin",
      "x-school-id": SCHOOL_A,
    });

    expect(response.status).toBe(401);
    expectNoDatabaseQueries();
  });

  // 14. Forged x-user-role header is ignored
  it("14. Forged x-user-role header cannot elevate a student token to admin", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("student")));
    const { response } = await callRoute(undefined, {
      "x-user-role": "admin",
    });

    expect(response.status).toBe(403);
    expectNoDatabaseQueries();
  });

  // 15. DB queries are not executed when authentication/authorization fails
  it("15. Verified that Student.find and countDocuments are never executed on auth/authz failure", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(undefined));
    await callRoute();
    expectNoDatabaseQueries();

    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("parent")));
    await callRoute();
    expectNoDatabaseQueries();

    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("teacher")));
    await callRoute();
    expectNoDatabaseQueries();
  });

  // 16. Pagination is preserved
  it("16. Pagination parameters (page, pageSize) are passed through to skip/limit and meta", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response, body } = await callRoute({ page: "3", pageSize: "15" });

    expect(response.status).toBe(200);
    expect(studentFindChain.skip).toHaveBeenCalledWith(30);
    expect(studentFindChain.limit).toHaveBeenCalledWith(15);
    expect(body.meta.page).toBe(3);
    expect(body.meta.pageSize).toBe(15);
  });

  // 17. pageSize remains bounded to the existing maximum (100)
  it("17. pageSize is clamped to a maximum of 100", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response, body } = await callRoute({ pageSize: "500" });

    expect(response.status).toBe(200);
    expect(studentFindChain.limit).toHaveBeenCalledWith(100);
    expect(body.meta.pageSize).toBe(100);
  });

  // 18. grade filter works
  it("18. Grade filter is applied to the database query", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response } = await callRoute({ grade: "10" });

    expect(response.status).toBe(200);
    expect(MStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        grade: "10",
      })
    );
    expect(MStudent.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        grade: "10",
      })
    );
  });

  // 19. section filter works
  it("19. Section filter is applied to the database query", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response } = await callRoute({ section: "A" });

    expect(response.status).toBe(200);
    expect(MStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        section: "A",
      })
    );
    expect(MStudent.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        section: "A",
      })
    );
  });

  // 20. search works
  it("20. Search parameter queries firstName, lastName, and studentCode with case-insensitivity", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response } = await callRoute({ search: "Aarav" });

    expect(response.status).toBe(200);
    expect(MStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        $or: [
          { firstName: { $regex: "Aarav", $options: "i" } },
          { lastName: { $regex: "Aarav", $options: "i" } },
          { studentCode: { $regex: "Aarav", $options: "i" } },
        ],
      })
    );
  });

  // 21. regex metacharacters in search are safely escaped
  it("21. Regex metacharacters in search parameter are safely escaped against ReDoS and injection", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const dangerousSearch = ".*+?^${}()|[]\\";
    const { response } = await callRoute({ search: dangerousSearch });

    expect(response.status).toBe(200);
    const expectedEscaped = "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\";
    expect(MStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_A,
        isActive: true,
        $or: [
          { firstName: { $regex: expectedEscaped, $options: "i" } },
          { lastName: { $regex: expectedEscaped, $options: "i" } },
          { studentCode: { $regex: expectedEscaped, $options: "i" } },
        ],
      })
    );
  });

  // 22. returned records do not expose the removed sensitive PII fields
  it("22. Returned records do not expose address, emergencyContact, dateOfBirth, or userId", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin")));
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);

    const firstStudent = body.data[0];
    expect(firstStudent.address).toBeUndefined();
    expect(firstStudent.emergencyContact).toBeUndefined();
    expect(firstStudent.dateOfBirth).toBeUndefined();
    expect(firstStudent.userId).toBeUndefined();

    // Verify authorized directory fields remain present
    expect(firstStudent.studentCode).toBe("STU-001");
    expect(firstStudent.firstName).toBe("Aarav");
    expect(firstStudent.lastName).toBe("Verma");
    expect(firstStudent.grade).toBe("10");
    expect(firstStudent.section).toBe("A");
    expect(firstStudent.schoolId).toBe(SCHOOL_A);
  });

  // 23. countDocuments is also school-scoped
  it("23. countDocuments query includes schoolId and isActive", async () => {
    mockCookies.mockResolvedValue(createMockCookieStore(await tokenFor("admin", ADMIN_USER_ID, SCHOOL_B)));
    setupAdminProfile(true, SCHOOL_B);
    const { response } = await callRoute();

    expect(response.status).toBe(200);
    expect(MStudent.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_B,
        isActive: true,
      })
    );
  });
});
