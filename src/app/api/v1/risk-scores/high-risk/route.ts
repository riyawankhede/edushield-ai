import { NextRequest } from "next/server";
import { RiskScoreService } from "@/services/risk-score.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return Response.json(
        { success: false, error: { code: "MISSING_SCHOOL_ID", message: "schoolId is required" } },
        { status: 400 }
      );
    }

    const highRiskStudents = await RiskScoreService.getHighRiskStudents(schoolId);

    return apiSuccess(highRiskStudents);
  } catch (error) {
    return handleAPIError(error);
  }
}