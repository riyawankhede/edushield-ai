import { NextRequest } from "next/server";
import { ParentService } from "@/services/parent.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ parentId: string }> }
) {
  try {
    // The verified JWT is the only trusted source of caller identity.
    const auth = await requireAuth(request);
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId") || undefined;

    const dashboardData = await ParentService.getAuthorizedParentDashboard(
      auth,
      params.parentId,
      studentId
    );

    return apiSuccess(dashboardData);
  } catch (error) {
    return handleAPIError(error);
  }
}
