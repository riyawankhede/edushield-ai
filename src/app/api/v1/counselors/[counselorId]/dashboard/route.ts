import { NextRequest } from "next/server";
import { CounselorService } from "@/services/counselor.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ counselorId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const params = await props.params;
    const dashboard = await CounselorService.getAuthorizedCounselorDashboard(
      auth,
      params.counselorId
    );
    return apiSuccess(dashboard);
  } catch (error) {
    return handleAPIError(error);
  }
}
