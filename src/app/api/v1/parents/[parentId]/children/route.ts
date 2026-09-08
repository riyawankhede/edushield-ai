import { NextRequest } from "next/server";
import { ParentService } from "@/services/parent.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ parentId: string }> }
) {
  try {
    const params = await props.params;
    const { parent, children } = await ParentService.getLinkedChildren(
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
