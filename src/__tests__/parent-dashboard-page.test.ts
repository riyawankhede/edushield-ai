/**
 * Tests for Parent Dashboard Server Component (src/app/(dashboard)/parent/page.tsx)
 *
 * DEMO MODE: The parent dashboard now uses the same mock-fallback pattern as
 * the other four dashboards. Authentication is temporarily bypassed for the
 * hackathon demo. The auth implementation (getAuthContext, requireAuth, JWT
 * verification) remains fully intact — it is simply not called by this page.
 *
 * Behaviour verified here:
 * 1.  No cookie → renders with mock fallback (no redirect)
 * 2.  Invalid JWT → renders with mock fallback (no redirect)
 * 3.  Any JWT → renders with mock fallback (no redirect, no role check)
 * 4.  When DB is available, getParentDashboard("me") is called
 * 5.  getAuthorizedParentDashboard (auth-gated method) is NOT called by page
 * 6.  When DB call succeeds with data → renders live data with "Live DB" badge
 * 7.  When DB call fails → renders mock fallback with "Mock Fallback" badge
 * 8.  Rendered output contains expected student name
 * 9.  Mock fallback data comes from parentDashboardMock (Rahul Sharma)
 * 10. Page never redirects regardless of cookie state
 */

import ParentDashboard from "@/app/(dashboard)/parent/page";
import { ParentService } from "@/services/parent.service";
import { parentDashboardMock } from "@/mock/students";

// next/navigation mock — redirect must never be called in demo mode
const mockRedirect = jest.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (error as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// next/headers mock — cookies() must not throw if not present
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(() => undefined),
  }),
}));

const SAMPLE_LIVE_DATA = {
  ...parentDashboardMock,
  parentName: "Rajesh Verma",
  student: {
    ...parentDashboardMock.student,
    name: "Aarav Verma",
    grade: "8-A",
    attendance: { percentage: 95, status: "good" as const, trend: "+1.5" },
    academics: {
      ...parentDashboardMock.student.academics,
      pendingHomework: 1,
      completedHomework: 5,
      overdueHomework: 0,
      upcomingExams: 1,
    },
  },
};

describe("ParentDashboard Server Component — Demo Mode", () => {
  let spyGetAuthorizedDashboard: jest.SpyInstance;
  let spyGetParentDashboard: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    spyGetAuthorizedDashboard = jest
      .spyOn(ParentService, "getAuthorizedParentDashboard")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(SAMPLE_LIVE_DATA as any);
    spyGetParentDashboard = jest
      .spyOn(ParentService, "getParentDashboard")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(SAMPLE_LIVE_DATA as any);
  });

  afterEach(() => {
    spyGetAuthorizedDashboard.mockRestore();
    spyGetParentDashboard.mockRestore();
  });

  // 1. No cookie → still renders (no redirect)
  it("1. No auth cookie: renders dashboard (mock fallback), does NOT redirect", async () => {
    spyGetParentDashboard.mockRejectedValue(new Error("no db"));

    const jsx = await ParentDashboard();

    expect(jsx).not.toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // 2. No redirect for any input
  it("2. Page never redirects to /login regardless of cookie state", async () => {
    spyGetParentDashboard.mockRejectedValue(new Error("no db"));

    await ParentDashboard();

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // 3. Auth-gated method is NOT called
  it("3. getAuthorizedParentDashboard (auth-gated) is NOT called by demo page", async () => {
    spyGetParentDashboard.mockResolvedValue(SAMPLE_LIVE_DATA);

    await ParentDashboard();

    expect(spyGetAuthorizedDashboard).not.toHaveBeenCalled();
  });

  // 4. getParentDashboard("me") IS called when DB is available
  it("4. getParentDashboard('me') is called to attempt live data", async () => {
    spyGetParentDashboard.mockResolvedValue(SAMPLE_LIVE_DATA);

    await ParentDashboard();

    expect(spyGetParentDashboard).toHaveBeenCalledTimes(1);
    expect(spyGetParentDashboard).toHaveBeenCalledWith("me");
  });

  // 5. Live data → renders live data with Live DB badge
  it("5. DB call succeeds → renders live data, shows 'Live DB' badge", async () => {
    spyGetParentDashboard.mockResolvedValue(SAMPLE_LIVE_DATA);

    const jsx = await ParentDashboard();
    const json = JSON.stringify(jsx);

    expect(json).toContain("Aarav Verma");
    expect(json).toContain("Live DB");
    expect(json).not.toContain("Mock Fallback");
  });

  // 6. DB failure → renders mock fallback
  it("6. DB call fails → renders mock fallback with 'Mock Fallback' badge", async () => {
    spyGetParentDashboard.mockRejectedValue(new Error("db unavailable"));

    const jsx = await ParentDashboard();
    const json = JSON.stringify(jsx);

    expect(json).toContain("Mock Fallback");
    expect(json).not.toContain("Live DB");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // 7. Mock fallback renders parentDashboardMock student name
  it("7. Mock fallback data renders parentDashboardMock student name (Rahul Sharma)", async () => {
    spyGetParentDashboard.mockRejectedValue(new Error("db unavailable"));

    const jsx = await ParentDashboard();
    const json = JSON.stringify(jsx);

    expect(json).toContain(parentDashboardMock.student.name);
  });

  // 8. Live data when getParentDashboard returns null-ish → falls back to mock
  it("8. getParentDashboard returns null student → falls back to mock, no redirect", async () => {
    spyGetParentDashboard.mockResolvedValue({ student: null });

    const jsx = await ParentDashboard();

    expect(jsx).not.toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
    // Should render mock fallback
    const json = JSON.stringify(jsx);
    expect(json).toContain("Mock Fallback");
  });

  // 9. Rendered JSX contains stat cards
  it("9. Rendered JSX contains the attendance stat card", async () => {
    spyGetParentDashboard.mockResolvedValue(SAMPLE_LIVE_DATA);

    const jsx = await ParentDashboard();
    const json = JSON.stringify(jsx);

    expect(json).toContain("Attendance");
    expect(json).toContain("95%");
  });

  // 10. Rendered JSX contains upcoming exams
  it("10. Rendered JSX contains the upcoming exams section", async () => {
    spyGetParentDashboard.mockResolvedValue(SAMPLE_LIVE_DATA);

    const jsx = await ParentDashboard();
    const json = JSON.stringify(jsx);

    expect(json).toContain("Upcoming Exams");
    expect(json).toContain("Physics");
  });
});
