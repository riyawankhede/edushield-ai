import { NextRequest } from "next/server";
import { NoticeService } from "@/services/notice.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(
      request,
      "admin",
      "teacher",
      "counselor",
      "parent",
      "student"
    );

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const priority = searchParams.get("priority") || undefined;
    const targetRole = searchParams.get("targetRole") || searchParams.get("audience") || undefined;
    const schoolId = searchParams.get("schoolId") || undefined;

    const result = await NoticeService.getAuthorizedNotices(auth, {
      page,
      pageSize,
      priority,
      targetRole,
      schoolId,
    });

    return apiSuccess(result.notices, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
