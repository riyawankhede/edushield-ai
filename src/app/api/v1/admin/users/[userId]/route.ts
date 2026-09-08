import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

/**
 * DELETE /api/v1/admin/users/:userId
 * Soft deletes user.
 *
 * PROTECTED: Admin role required via JWT authentication
 * SCHOOL ISOLATION: Can only delete users in authenticated admin's school
 * CRITICAL GUARDS:
 * 1. Only admin can call this route (enforced via JWT)
 * 2. Cannot delete an administrator account!
 * 3. Cannot delete users from other schools
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    // JWT-based authentication and admin role verification
    const auth = await requireAuth(request, "admin");

    const params = await props.params;

    // School isolation enforced in AdminService.deleteUser via schoolId check
    const result = await AdminService.deleteUser(params.userId, auth.userId, auth.schoolId);
    return apiSuccess(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
