import { NextRequest } from "next/server";
import { ParentService } from "@/services/parent.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ parentId: string }> }
) {
  try {
    // 1. AUTHENTICATION: identity MUST come from the verified JWT cookie.
    //    x-user-id / x-user-role / query / body identity are never trusted.
    const auth = await requireAuth(request);

    // 2. AUTHORIZATION + DATA: service-layer role scoping (parent = own
    //    children only, admin = same-school parents, all other roles denied).
    //    The URL parentId is only a resource selector — it never proves
    //    ownership, and no client input can override auth.userId/auth.schoolId.
    const params = await props.params;
    const { parent, children } = await ParentService.getAuthorizedLinkedChildren(
      auth,
      params.parentId
    );

    return apiSuccess({
      parentId: parent._id.toString(),
      parentName: `${parent.firstName} ${parent.lastName}`,
      totalChildren: children.length,
      children,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
