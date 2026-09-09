/**
 * Auth wiring for the four student sibling GET routes:
 * attendance / results / assignments / summary.
 * JWT cookie only -> gate via getAuthorizedStudentProfile (403 on scope
 * failure) -> only then call the data method. Forged headers never trusted.
 */
import { NextRequest } from "next/server";
import { signAccessToken } from "@/lib/jwt";
import { APIError } from "@/lib/api-error";
import { GET as getAttendance } from "@/app/api/v1/students/[studentId]/attendance/route";
import { GET as getResults } from "@/app/api/v1/students/[studentId]/results/route";
import { GET as getAssignments } from "@/app/api/v1/students/[studentId]/assignments/route";
import { GET as getSummary } from "@/app/api/v1/students/[studentId]/summary/route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));
jest.mock("@/services/student.service", () => ({
  StudentService: {
    getAuthorizedStudentProfile: jest.fn(),
    getStudentAttendance: jest.fn(),
    getStudentResults: jest.fn(),
    getStudentAssignments: jest.fn(),
    getStudentSummary: jest.fn(),
  },
}));

import { cookies } from "next/headers";
import { StudentService } from "@/services/student.service";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockSvc = StudentService as unknown as {
  getAuthorizedStudentProfile: jest.Mock;
  getStudentAttendance: jest.Mock;
  getStudentResults: jest.Mock;
  getStudentAssignments: jest.Mock;
  getStudentSummary: jest.Mock;
};

const TSECRET = "test-secret-that-is-long-enough-32chars!";
const SCHA = "64a1b2c3d4e5f6a7b8c9d0e0";
const STUID = "64a1b2c3d4e5f6a7b8c9d0f3";
const OTHER = "64a1b2c3d4e5f6a7b8c9d0ff";
const USRID = "64a1b2c3d4e5f6a7b8c9d0e1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cstore(v: string | undefined): any {
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

async function validCookie() {
  const t = await signAccessToken({ userId: USRID, role: "student", schoolId: SCHA });
  mockCookies.mockResolvedValue(cstore(t));
}

beforeAll(() => {
  process.env.ACCESS_TOKEN_SECRET = TSECRET;
});

afterAll(() => {
  delete process.env.ACCESS_TOKEN_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const ROUTES = [
  {
    name: "attendance",
    get: getAttendance,
    dataMethod: "getStudentAttendance" as const,
    dataValue: { records: [{ status: "present" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
  },
  {
    name: "results",
    get: getResults,
    dataMethod: "getStudentResults" as const,
    dataValue: { results: [{ marksObtained: 20 }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
  },
  {
    name: "assignments",
    get: getAssignments,
    dataMethod: "getStudentAssignments" as const,
    dataValue: { submissions: [{ status: "graded" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
  },
  {
    name: "summary",
    get: getSummary,
    dataMethod: "getStudentSummary" as const,
    dataValue: { id: STUID, attendance: { percentage: 95 } },
  },
] as const;

describe.each(ROUTES.map((r) => [r.name]))("sibling route: %s", (name) => {
  const cfg = ROUTES.find((r) => r.name === name)!;

  it("unauthenticated request -> 401 and no service calls", async () => {
    mockCookies.mockResolvedValue(cstore(undefined));
    const res = await cfg.get(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
    expect(mockSvc[cfg.dataMethod]).not.toHaveBeenCalled();
  });

  it("invalid JWT -> 401", async () => {
    mockCookies.mockResolvedValue(cstore("bad-token"));
    const res = await cfg.get(req(STUID), par(STUID));
    expect(res.status).toBe(401);
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
    expect(mockSvc[cfg.dataMethod]).not.toHaveBeenCalled();
  });

  it("expired JWT -> 401", async () => {
    mockCookies.mockResolvedValue(cstore(await expJwt()));
    const res = await cfg.get(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(mockSvc.getAuthorizedStudentProfile).not.toHaveBeenCalled();
    expect(mockSvc[cfg.dataMethod]).not.toHaveBeenCalled();
  });

  it("out-of-scope URL id -> 403, data method never called, no data", async () => {
    await validCookie();
    mockSvc.getAuthorizedStudentProfile.mockRejectedValue(APIError.forbidden("denied-scope"));
    const res = await cfg.get(req(OTHER), par(OTHER));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.data).toBeUndefined();
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      { userId: USRID, role: "student", schoolId: SCHA },
      OTHER
    );
    expect(mockSvc[cfg.dataMethod]).not.toHaveBeenCalled();
  });

  it("forged x-user-id and x-user-role cannot bypass JWT scope", async () => {
    await validCookie();
    mockSvc.getAuthorizedStudentProfile.mockRejectedValue(APIError.forbidden("denied-scope"));
    const res = await cfg.get(
      req(OTHER, { "x-user-id": "forged", "x-user-role": "admin" }),
      par(OTHER)
    );
    expect(res.status).toBe(403);
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      { userId: USRID, role: "student", schoolId: SCHA },
      OTHER
    );
    expect(mockSvc[cfg.dataMethod]).not.toHaveBeenCalled();
  });

  it("in-scope request gates first, then reads data with kept shape", async () => {
    await validCookie();
    mockSvc.getAuthorizedStudentProfile.mockResolvedValue({ _id: STUID, firstName: "Aarav" });
    mockSvc[cfg.dataMethod].mockResolvedValue(cfg.dataValue);
    const res = await cfg.get(req(STUID), par(STUID));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(mockSvc.getAuthorizedStudentProfile).toHaveBeenCalledWith(
      { userId: USRID, role: "student", schoolId: SCHA },
      STUID
    );
    expect(mockSvc[cfg.dataMethod]).toHaveBeenCalled();
    const gateOrder = mockSvc.getAuthorizedStudentProfile.mock.invocationCallOrder[0];
    const dataOrder = mockSvc[cfg.dataMethod].mock.invocationCallOrder[0];
    expect(gateOrder).toBeLessThan(dataOrder);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });
});
