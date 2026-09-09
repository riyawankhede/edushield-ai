import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    // JWT is the ONLY authoritative identity source. No x-user-id,
    // x-user-role, query, or body identity is trusted here.
    const auth = await requireAuth(request);
    const params = await props.params;
    // Reuse Phase 2C authorization semantics: ownership/scope proven here
    // (403 on failure, no existence oracle) before any data is read.
    await StudentService.getAuthorizedStudentProfile(auth, params.studentId);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    const result = await StudentService.getStudentAttendance(params.studentId, {
      page,
      pageSize,
      fromDate,
      toDate,
    });

    return apiSuccess(result.records, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
