import { NextRequest } from "next/server";
import { ParentService } from "@/services/parent.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    // JWT claims are the only trusted caller identity for this directory.
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));

    const directory = await ParentService.getAuthorizedParentDirectory(auth, {
      page,
      pageSize,
    });

    return apiSuccess(directory.parents, directory.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}
