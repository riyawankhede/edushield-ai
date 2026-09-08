import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/v1/admin/users
 * Lists users, filterable by role
 *
 * PROTECTED: Admin role required via JWT authentication
 */
export async function GET(request: NextRequest) {
  try {
    // JWT-based authentication and admin role verification
    await requireAuth(request, "admin");

    const { searchParams } = new URL(request.url);
    const filterRole = searchParams.get("role") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));

    const result = await AdminService.getUsers({
      role: filterRole,
      page,
      pageSize,
    });

    return apiSuccess(result.users, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * POST /api/v1/admin/users
 * Create a new user account
 *
 * PROTECTED: Admin role required via JWT authentication
 * SCHOOL ISOLATION: Users created in authenticated admin's school only
 */
export async function POST(request: NextRequest) {
  try {
    // JWT-based authentication and admin role verification
    const auth = await requireAuth(request, "admin");

    const body = await request.json();

    if (!body.email || !body.role) {
      throw APIError.validationError("Missing required fields: email and role are required.");
    }

    // School isolation: Enforce authenticated admin's schoolId
    // Client cannot create users in other schools
    if (body.schoolId && body.schoolId !== auth.schoolId) {
      throw APIError.forbidden("Cannot create users in other schools.");
    }

    // Use authenticated admin's schoolId
    const userData = {
      ...body,
      schoolId: auth.schoolId, // Always use authenticated schoolId
    };

    const newUser = await AdminService.createUser(userData, auth.userId);
    return apiSuccess(newUser, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
