import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const status = searchParams.get("status") || undefined;

    const result = await StudentService.getStudentAssignments(params.studentId, {
      page,
      pageSize,
      status,
    });

    return apiSuccess(result.submissions, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
