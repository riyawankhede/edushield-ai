import { NextRequest } from "next/server";
import { StudentService } from "@/services/student.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    // JWT claims are the only trusted caller identity for this directory.
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const rawPageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20;
    const pageSize = Math.min(100, Math.max(1, rawPageSize));
    const grade = searchParams.get("grade") || undefined;
    const section = searchParams.get("section") || undefined;
    const search = searchParams.get("search") || undefined;

    const directory = await StudentService.getAuthorizedStudentDirectory(auth, {
      page,
      pageSize,
      grade,
      section,
      search,
    });

    return apiSuccess(directory.students, directory.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}

