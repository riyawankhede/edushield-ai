import { NextRequest } from "next/server";
import { TeacherService } from "@/services/teacher.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ teacherId: string }> }
) {
  try {
    const auth = await requireAuth(request, "teacher", "admin");
    const params = await props.params;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId") || undefined;

    const dashboard = await TeacherService.getAuthorizedTeacherDashboard(
      auth,
      params.teacherId,
      { classId }
    );
    return apiSuccess(dashboard);
  } catch (error) {
    return handleAPIError(error);
  }
}
