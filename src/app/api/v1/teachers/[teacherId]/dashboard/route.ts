import { NextRequest } from "next/server";
import { TeacherService } from "@/services/teacher.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ teacherId: string }> }
) {
  try {
    const params = await props.params;
    const dashboard = await TeacherService.getTeacherDashboard(params.teacherId);
    return apiSuccess(dashboard);
  } catch (error) {
    return handleAPIError(error);
  }
}
