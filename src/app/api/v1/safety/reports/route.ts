import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { SafetyReport } from "@/models";
import { CounselorService } from "@/services/counselor.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

/**
 * GET /api/v1/safety/reports
 *
 * CRITICAL SECURITY BOUNDARY (docs/SECURITY_MODEL.md & docs/AUTHORIZATION_MATRIX.md):
 * 1. SERVER-SIDE ROLE CHECK & JWT AUTHENTICATION:
 *    Only active counselors and administrators in the authenticated school may view safety reports.
 *    Any request with missing, invalid, or unauthorized role is REJECTED with 403 Forbidden!
 * 2. ANONYMITY SHIELD: Even for counselors and admins, if isAnonymous === true,
 *    the reporter's identity is permanently stripped from the response!
 * 3. TENANT ISOLATION: Scoped strictly to auth.schoolId.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const rawPageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20;
    const pageSize = Math.min(100, Math.max(1, rawPageSize));
    const status = searchParams.get("status") || undefined;

    const result = await CounselorService.getAuthorizedSafetyReports(auth, {
      page,
      pageSize,
      status,
    });

    return apiSuccess(result.reports, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * POST /api/v1/safety/reports
 * Submit a safety or bullying report
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const {
      description,
      reportType,
      locationDescription,
      isAnonymous,
      reporterStudentId,
      schoolId,
    } = body;

    if (!description) {
      throw APIError.validationError("Missing required fields: description is required.");
    }

    // ANONYMOUS REPORT SHIELD:
    // If isAnonymous === true, NEVER store or link reporterStudentId!
    const reportData = {
      description,
      reportType: reportType || "other",
      locationDescription: locationDescription || "Campus Grounds",
      status: "new",
      isAnonymous: Boolean(isAnonymous),
      reporterStudentId: isAnonymous ? undefined : reporterStudentId,
      schoolId: schoolId || (await SafetyReport.findOne().lean())?.schoolId,
    };

    const report = await SafetyReport.create(reportData);

    return apiSuccess(
      {
        _id: report._id.toString(),
        reportType: report.reportType,
        status: report.status,
        isAnonymous: report.isAnonymous,
        message: "Safety report submitted successfully.",
      },
      undefined,
      201
    );
  } catch (error) {
    return handleAPIError(error);
  }
}
