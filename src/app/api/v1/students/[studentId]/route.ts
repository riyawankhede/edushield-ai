import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await props.params;
    const profile = await StudentService.getStudentProfile(params.studentId);
    return apiSuccess(profile);
  } catch (error) {
    return handleAPIError(error);
  }
}
