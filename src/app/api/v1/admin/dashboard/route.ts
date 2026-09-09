import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, "admin");

    const dashboard = await AdminService.getAuthorizedAdminDashboard(auth);
    return apiSuccess(dashboard);
  } catch (error) {
    return handleAPIError(error);
  }
}
