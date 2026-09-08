import { NextRequest } from "next/server";
import { ParentService } from "@/services/parent.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ parentId: string }> }
) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId") || undefined;

    const dashboardData = await ParentService.getParentDashboard(
      params.parentId,
      studentId
    );

    return apiSuccess(dashboardData);
  } catch (error) {
    return handleAPIError(error);
  }
}
