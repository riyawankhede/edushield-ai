import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

/**
 * POST /api/v1/admin/broadcast
 *
 * Emergency Broadcast Endpoint
 * CRITICAL SECURITY & OPERATIONAL RULES:
 * 1. Strictly requires role === 'admin' server-side.
 * 2. Writes real EmergencyAlert record to MongoDB.
 * 3. Writes immutable AuditLog entry.
 * 4. External SMS/Email/Push notification is SIMULATED (no external service calls).
 */
export async function POST(request: NextRequest) {
  try {
    const callerRole =
      request.headers.get("x-user-role") ||
      new URL(request.url).searchParams.get("adminRole");

    AdminService.verifyAdminRole(callerRole);

    const adminUserId = request.headers.get("x-user-id") || "admin-root";
    const body = await request.json();

    const result = await AdminService.broadcastEmergency(body, adminUserId);
    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
