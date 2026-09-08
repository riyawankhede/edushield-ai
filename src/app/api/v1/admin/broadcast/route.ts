import { NextRequest } from "next/server";
import { AdminService } from "@/services/admin.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/v1/admin/broadcast
 *
 * Emergency Broadcast Endpoint
 *
 * PROTECTED: Admin role required via JWT authentication
 * SCHOOL ISOLATION: Broadcasts restricted to authenticated admin's school
 * CRITICAL SECURITY & OPERATIONAL RULES:
 * 1. Strictly requires role === 'admin' via JWT verification
 * 2. Writes real EmergencyAlert record to MongoDB
 * 3. Writes immutable AuditLog entry
 * 4. External SMS/Email/Push notification is SIMULATED (no external service calls)
 */
export async function POST(request: NextRequest) {
  try {
    // JWT-based authentication and admin role verification
    const auth = await requireAuth(request, "admin");

    const body = await request.json();

    // School isolation: Enforce authenticated admin's schoolId
    // Broadcast data must include schoolId from auth, not from client
    const broadcastData = {
      ...body,
      schoolId: auth.schoolId, // Always use authenticated schoolId
    };

    const result = await AdminService.broadcastEmergency(broadcastData, auth.userId);
    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
