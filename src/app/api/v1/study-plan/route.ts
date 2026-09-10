/**
 * GET /api/v1/study-plan
 * 
 * Generate or retrieve personalized study plan for a student
 * 
 * Query Parameters:
 * - studentId: string (required) - Student ObjectId or "me"
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     studentId: string,
 *     schoolId: string,
 *     generatedAt: Date,
 *     items: Array<{
 *       subjectName: string,
 *       priority: "high" | "medium" | "low",
 *       recommendedDuration: number,
 *       focusArea: string,
 *       reason: string,
 *       weakTopics: string[]
 *     }>,
 *     totalRecommendedTime: number,
 *     disclaimer: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { StudyPlannerService } from "@/services/study-planner.service";
import { APIError } from "@/lib/api-error";
import Student from "@/models/Student";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("studentId");

    // DEMO MODE: For hackathon, accept any studentId
    // In production, this would use auth context to verify access
    if (!studentIdParam) {
      throw APIError.validationError("studentId is required");
    }

    await connectDB();

    // Resolve student
    let studentId: string;
    let schoolId: string;

    if (studentIdParam === "me") {
      // For demo, use first active student
      const student = await Student.findOne({ isActive: true })
        .select("_id schoolId")
        .lean();
      if (!student) {
        throw APIError.notFound("No student found");
      }
      studentId = student._id.toString();
      schoolId = student.schoolId.toString();
    } else {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(studentIdParam)) {
        throw APIError.validationError("Invalid studentId format");
      }

      const student = await Student.findOne({
        _id: studentIdParam,
        isActive: true,
      })
        .select("_id schoolId")
        .lean();

      if (!student) {
        throw APIError.notFound("Student not found");
      }

      studentId = student._id.toString();
      schoolId = student.schoolId.toString();
    }

    // Try to get recent study plan first (cached)
    let studyPlan = await StudyPlannerService.getRecentStudyPlan(
      studentId,
      schoolId
    );

    // If no recent plan or plan is old (> 7 days), generate new
    if (
      !studyPlan ||
      Date.now() - studyPlan.generatedAt.getTime() > 7 * 24 * 60 * 60 * 1000
    ) {
      studyPlan = await StudyPlannerService.generateStudyPlan(
        studentId,
        schoolId
      );
    }

    return NextResponse.json({
      success: true,
      data: studyPlan,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.httpStatus }
      );
    }

    console.error("[Study Plan API Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
