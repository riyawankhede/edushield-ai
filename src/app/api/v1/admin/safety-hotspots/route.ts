import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const role =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("adminRole");

    AdminService.verifyAdminRole(role);

    const hotspots = await AdminService.getSafetyHotspots();
    return apiSuccess(hotspots);
  } catch (error) {
    return handleAPIError(error);
  }
}
