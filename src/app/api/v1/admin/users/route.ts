import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

/**
 * GET /api/v1/admin/users
 * Lists users, filterable by role
 */
export async function GET(request: NextRequest) {
  try {
    const role =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("adminRole");

    AdminService.verifyAdminRole(role);

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
 */
export async function POST(request: NextRequest) {
  try {
    const callerRole =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("adminRole");

    AdminService.verifyAdminRole(callerRole);

    const adminUserId = request.headers.get("x-user-id") || "admin-root";
    const body = await request.json();

    if (!body.email || !body.role) {
      throw APIError.validationError("Missing required fields: email and role are required.");
    }

    const newUser = await AdminService.createUser(body, adminUserId);
    return apiSuccess(newUser, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
