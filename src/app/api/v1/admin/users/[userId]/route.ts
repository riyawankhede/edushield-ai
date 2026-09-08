import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

/**
 * DELETE /api/v1/admin/users/:userId
 * Soft deletes user.
 * CRITICAL GUARDS:
 * 1. Only admin can call this route.
 * 2. Cannot delete an administrator account!
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const callerRole =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("adminRole");

    AdminService.verifyAdminRole(callerRole);

    const params = await props.params;
    const adminUserId = request.headers.get("x-user-id") || "admin-root";

    const result = await AdminService.deleteUser(params.userId, adminUserId);
    return apiSuccess(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
