import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    // JWT is the ONLY authoritative identity source. No x-user-id,
    // x-user-role, query, or body identity is trusted here.
    const auth = await requireAuth(request);
    const params = await props.params;
    const profile = await StudentService.getAuthorizedStudentProfile(auth, params.studentId);
    return apiSuccess(profile);
  } catch (error) {
    return handleAPIError(error);
  }
}
