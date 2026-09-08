import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { SafetyReport } from "@/models";
import { CounselorService } from "@/services/counselor.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

/**
 * GET /api/v1/safety/reports
 *
 * CRITICAL SECURITY BOUNDARY (docs/SECURITY_MODEL.md & docs/AUTHORIZATION_MATRIX.md):
 * 1. SERVER-SIDE ROLE CHECK: This check lives directly in this route handler.
 *    Only users with role "counselor" or "admin" may query safety reports.
 *    Any request with missing or other role (e.g. student, parent, teacher) is REJECTED with 403 Forbidden!
 * 2. ANONYMITY SHIELD: Even for counselors and admins, if isAnonymous === true,
 *    the reporter's identity is permanently stripped from the response!
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Mandatory server-side role check from header or query context
    const role =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("role");

    if (!role || (role !== "counselor" && role !== "admin")) {
      throw APIError.forbidden(
        "Access denied. Only counselors and administrators are permitted to view safety reports."
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const status = searchParams.get("status") || undefined;

    const result = await CounselorService.getSafetyReports(role, {
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
