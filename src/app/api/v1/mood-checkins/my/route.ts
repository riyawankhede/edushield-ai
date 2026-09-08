import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const studentId = searchParams.get("studentId") || "me";

    const result = await StudentService.getStudentMoodCheckins(studentId, {
      page,
      pageSize,
    });

    return apiSuccess(result.checkins, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
