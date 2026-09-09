/**
 * Route-level auth wiring for GET /api/v1/students/:studentId.
 * Service authorization matrix is covered in part B of this file.
 */
import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { APIError } from "@/lib/api-error";
import { GET as getStudent } from "@/app/api/v1/students/[studentId]/route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));
jest.mock("@/services/student.service", () => ({
  StudentService: { getAuthorizedStudentProfile: jest.fn() },
}));

import { cookies } from "next/headers";
import { StudentService } from "@/services/student.service";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockSvc = StudentService as unknown as {
  getAuthorizedStudentProfile: jest.Mock;
};

const TSECRET = "test-secret-that-is-long-enough-32chars!";
const SCHA = "64a1b2c3d4e5f6a7b8c9d0e0";
const STUID = "64a1b2c3d4e5f6a7b8c9d0f3";
const USRID = "64a1b2c3d4e5f6a7b8c9d0e1";
const OTHER = "64a1b2c3d4e5f6a7b8c9d0ff";

function cstore(
  v: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return {
    get: jest.fn((n: string) => {
      if (n === "access_token" && v !== undefined) return { name: n, value: v };
      return undefined;
    }),
  };
}

function req(id: string, headers?: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/v1/students/" + id, {
    method: "GET",
    headers: { ...(headers || {}) },
  });
}

function par(id: string) {
  return { params: Promise.resolve({ studentId: id }) };
}

async function expJwt() {
  const { SignJWT } = await import("jose");
  const s = new TextEncoder().encode(TSECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ userId: USRID, role: "student", schoolId: SCHA })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 600)
    .setExpirationTime(now - 60)
    .sign(s);
}

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = TSECRET;
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  mockSvc.getAuthorizedStudentProfile.mockClear();
  (cookies as jest.Mock).mockClear();
});

describe("route auth wiring", () => {
  it("unauthenticated gives 401", async () => {
    mockCookies.mockResolvedValue(cstore(undefined));
    const res = await getStudent(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
  });

  it("bad token gives 401", async () => {
    mockCookies.mockResolvedValue(cstore("bad-token"));
    const res = await getStudent(req(STUID), par(STUID));
    expect(res.status).toBe(401);
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
  });

  it("expired token gives 401", async () => {
    mockCookies.mockResolvedValue(cstore(await expJwt()));
    const res = await getStudent(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
  });

  it("delegates own-student scope to service", async () => {
    const t = await signAccessToken({ userId: USRID, role: "student", schoolId: SCHA });
    mockCookies.mockResolvedValue(cstore(t));
    mockSvc.getAuthorizedStudentProfile.mockResolvedValue({ _id: STUID, firstName: "Aarav" });
    const res = await getStudent(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      { userId: USRID, role: "student", schoolId: SCHA },
      STUID
    );
    expect(data.data.firstName).toBe("Aarav");
  });

  it("wrong role denied by service stays denied", async () => {
    const t = await signAccessToken({ userId: USRID, role: "student", schoolId: SCHA });
    mockCookies.mockResolvedValue(cstore(t));
    mockSvc.getAuthorizedStudentProfile.mockRejectedValue(APIError.forbidden("denied-scope"));
    const res = await getStudent(req(OTHER), par(OTHER));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.data).toBeUndefined();
  });

  it("forged headers cannot bypass auth", async () => {
    const t = await signAccessToken({ userId: USRID, role: "student", schoolId: SCHA });
    mockCookies.mockResolvedValue(cstore(t));
    mockSvc.getAuthorizedStudentProfile.mockRejectedValue(APIError.forbidden("denied-scope"));
    const res = await getStudent(
      req(OTHER, { "x-user-id": "forged", "x-user-role": "admin" }),
      par(OTHER)
    );
    expect(res.status).toBe(403);
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      { userId: USRID, role: "student", schoolId: SCHA },
      OTHER
    );
  });

  it("URL id is the scope selector", async () => {
    const t = await signAccessToken({ userId: USRID, role: "student", schoolId: SCHA });
    mockCookies.mockResolvedValue(cstore(t));
    mockSvc.getAuthorizedStudentProfile.mockRejectedValue(APIError.forbidden("denied-scope"));
    const res = await getStudent(req(OTHER), par(OTHER));
    expect(res.status).toBe(403);
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USRID }),
      OTHER
    );
  });
});
