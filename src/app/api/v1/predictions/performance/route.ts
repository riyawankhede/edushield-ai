/**
 * GET /api/v1/predictions/performance
 * 
 * Generate or retrieve academic performance prediction for a student
 * 
 * Query Parameters:
 * - studentId: string (required) - Student ObjectId or "me" for authenticated student
 * - subjectId: string (optional) - Subject ObjectId for subject-specific prediction
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     predictedScore: number,
 *     predictedGradeBand: string,
 *     confidence: number,
 *     inputFeatures: {...},
 *     modelName: string,
 *     modelVersion: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { PerformancePredictionService } from "@/services/performance-prediction.service";
import { APIError } from "@/lib/api-error";
import Student from "@/models/Student";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get("studentId");
    const subjectId = searchParams.get("subjectId") || undefined;

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

    // Generate or retrieve prediction
    const prediction = await PerformancePredictionService.predictStudentPerformance(
      studentId,
      schoolId,
      subjectId
    );

    return NextResponse.json({
      success: true,
      data: prediction,
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

    console.error("[Performance Prediction API Error]", error);
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
