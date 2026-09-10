import { NextRequest } from "next/server";
import { RiskScoreService } from "@/services/risk-score.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return Response.json(
        { success: false, error: { code: "MISSING_SCHOOL_ID", message: "schoolId is required" } },
        { status: 400 }
      );
    }

    const riskScore = await RiskScoreService.getStudentRiskScore(params.studentId, schoolId);

    return apiSuccess(riskScore);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await props.params;
    const body = await request.json();
    const { schoolId } = body;

    if (!schoolId) {
      return Response.json(
        { success: false, error: { code: "MISSING_SCHOOL_ID", message: "schoolId is required" } },
        { status: 400 }
      );
    }

    // Generate new risk score
    const riskScore = await RiskScoreService.calculateRiskScore(params.studentId, schoolId);

    return apiSuccess(riskScore);
  } catch (error) {
    return handleAPIError(error);
  }
}