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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));

    const result = await AdminService.getAuditLogs({ page, pageSize });
    return apiSuccess(result.logs, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
