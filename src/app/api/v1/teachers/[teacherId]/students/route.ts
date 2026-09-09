import { NextRequest } from "next/server";
import { TeacherService } from "@/services/teacher.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ teacherId: string }> }
) {
  try {
    const auth = await requireAuth(request, "teacher", "admin");
    const params = await props.params;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const classId = searchParams.get("classId") || undefined;

    const result = await TeacherService.getAuthorizedTeacherStudents(
      auth,
      params.teacherId,
      { page, pageSize, classId }
    );

    return apiSuccess(result.students, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
