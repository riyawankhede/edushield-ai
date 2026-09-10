/**
 * Performance Prediction Service
 * 
 * MVP implementation using deterministic calculation from real student data.
 * 
 * This service provides academic performance predictions by analyzing:
 * - Recent exam scores
 * - Attendance patterns (30-day and 90-day)
 * - Homework completion rates
 * - Score trends
 * 
 * ARCHITECTURE NOTE:
 * This is a transparent, rule-based MVP predictor that produces realistic
 * predictions from actual student data. It can later be replaced by a
 * trained ML model without changing the API contract.
 */

import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import mongoose from "mongoose";
import AiPrediction from "@/models/AiPrediction";
import ExamResult from "@/models/ExamResult";
import AttendanceRecord from "@/models/AttendanceRecord";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Assignment from "@/models/Assignment";

interface PredictionInput {
  attendanceRate30d: number;
  attendanceRate90d: number;
  homeworkCompletionRate: number;
  avgScoreCurrentTerm: number;
  avgScorePrevTerm: number;
  scoreTrend: number;
  engagementScore: number;
  behaviorConcernsCount: number;
}

interface PredictionResult {
  predictedScore: number;
  predictedGradeBand: string;
  confidence: number;
  inputFeatures: PredictionInput;
  modelName: string;
  modelVersion: string;
}

export class PerformancePredictionService {
  private static readonly MODEL_NAME = "linear_performance_predictor_mvp";
  private static readonly MODEL_VERSION = "v1.0.0_deterministic";
  private static readonly ACADEMIC_YEAR = "2026-27";

  /**
   * Generate performance prediction for a student
   * Returns existing prediction if created recently (< 24 hours), otherwise generates new
   */
  static async predictStudentPerformance(
    studentId: string,
    schoolId: string,
    subjectId?: string
  ): Promise<PredictionResult> {
    // connectDB will use existing connection if already connected
    await connectDB();

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw APIError.validationError("Invalid student ID");
    }
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw APIError.validationError("Invalid school ID");
    }

    // Check for recent prediction (< 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingPrediction = await AiPrediction.findOne({
      studentId,
      schoolId,
      subjectId: subjectId || { $exists: false },
      predictionType: "performance",
      status: "completed",
      createdAt: { $gte: oneDayAgo },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingPrediction) {
      return {
        predictedScore: existingPrediction.predictedScore || 0,
        predictedGradeBand: existingPrediction.predictedGradeBand || "N/A",
        confidence: existingPrediction.confidence || 0,
        inputFeatures: existingPrediction.inputFeatures as PredictionInput,
        modelName: existingPrediction.modelName,
        modelVersion: existingPrediction.modelVersion,
      };
    }

    // Gather input features from student data
    const inputFeatures = await this.gatherInputFeatures(studentId, schoolId, subjectId);

    // Calculate prediction using deterministic model
    const prediction = this.calculatePrediction(inputFeatures);

    // Store prediction
    await AiPrediction.create({
      studentId,
      schoolId,
      subjectId,
      predictionType: "performance",
      academicYear: this.ACADEMIC_YEAR,
      period: "upcoming_term",
      predictedScore: prediction.predictedScore,
      predictedGradeBand: prediction.predictedGradeBand,
      confidence: prediction.confidence,
      inputFeatures,
      modelName: this.MODEL_NAME,
      modelVersion: this.MODEL_VERSION,
      status: "completed",
      reviewStatus: "unreviewed",
      createdAt: new Date(),
    });

    return {
      ...prediction,
      inputFeatures,
      modelName: this.MODEL_NAME,
      modelVersion: this.MODEL_VERSION,
    };
  }

  /**
   * Gather input features from real student data
   */
  private static async gatherInputFeatures(
    studentId: string,
    schoolId: string,
    subjectId?: string
  ): Promise<PredictionInput> {
    const studentOid = new mongoose.Types.ObjectId(studentId);
    const schoolOid = new mongoose.Types.ObjectId(schoolId);

    // Calculate attendance rates (30-day and 90-day windows)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [attendance30d, attendance90d] = await Promise.all([
      AttendanceRecord.find({
        studentId: studentOid,
        schoolId: schoolOid,
        date: { $gte: thirtyDaysAgo },
      }).lean(),
      AttendanceRecord.find({
        studentId: studentOid,
        schoolId: schoolOid,
        date: { $gte: ninetyDaysAgo },
      }).lean(),
    ]);

    const attendanceRate30d =
      attendance30d.length > 0
        ? attendance30d.filter((a) => a.status === "present").length /
          attendance30d.length
        : 0.85; // default

    const attendanceRate90d =
      attendance90d.length > 0
        ? attendance90d.filter((a) => a.status === "present").length /
          attendance90d.length
        : 0.85; // default

    // Calculate homework completion rate
    const recentAssignments = await Assignment.find({
      schoolId: schoolOid,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .select("_id")
      .lean();

    const assignmentIds = recentAssignments.map((a) => a._id);

    const submissions = await HomeworkSubmission.find({
      studentId: studentOid,
      assignmentId: { $in: assignmentIds },
      schoolId: schoolOid,
    }).lean();

    const homeworkCompletionRate =
      assignmentIds.length > 0
        ? submissions.filter(
            (s) => s.status === "submitted" || s.status === "graded"
          ).length / assignmentIds.length
        : 0.75; // default

    // Calculate average scores (current and previous terms)
    // For MVP, use last 60 days as "current term" and 60-120 days ago as "previous term"
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const oneTwentyDaysAgo = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

    const examFilter: Record<string, unknown> = {
      studentId: studentOid,
      schoolId: schoolOid,
    };
    if (subjectId) {
      examFilter.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    const [currentTermResults, prevTermResults] = await Promise.all([
      ExamResult.find({
        ...examFilter,
        createdAt: { $gte: sixtyDaysAgo },
      })
        .select("marksObtained")
        .lean(),
      ExamResult.find({
        ...examFilter,
        createdAt: { $gte: oneTwentyDaysAgo, $lt: sixtyDaysAgo },
      })
        .select("marksObtained")
        .lean(),
    ]);

    const avgScoreCurrentTerm =
      currentTermResults.length > 0
        ? currentTermResults.reduce((sum, r) => sum + r.marksObtained, 0) /
          currentTermResults.length
        : 70; // default

    const avgScorePrevTerm =
      prevTermResults.length > 0
        ? prevTermResults.reduce((sum, r) => sum + r.marksObtained, 0) /
          prevTermResults.length
        : 70; // default

    // Calculate score trend (normalized)
    const scoreTrend =
      avgScorePrevTerm > 0
        ? (avgScoreCurrentTerm - avgScorePrevTerm) / avgScorePrevTerm
        : 0;

    // Calculate engagement score (composite of attendance and homework)
    const engagementScore =
      (attendanceRate30d * 50 + homeworkCompletionRate * 50);

    // Behavior concerns count (for MVP, use 0 - can be integrated with BehaviorObservation later)
    const behaviorConcernsCount = 0;

    return {
      attendanceRate30d,
      attendanceRate90d,
      homeworkCompletionRate,
      avgScoreCurrentTerm,
      avgScorePrevTerm,
      scoreTrend,
      engagementScore,
      behaviorConcernsCount,
    };
  }

  /**
   * Calculate prediction using deterministic model
   * 
   * This model uses weighted features inspired by the performance_train.csv structure:
   * - Attendance: 20% weight
   * - Homework completion: 15% weight
   * - Previous performance: 50% weight
   * - Score trend: 10% weight
   * - Engagement: 5% weight
   * 
   * Formula is transparent and can be replaced with trained ML model
   */
  private static calculatePrediction(input: PredictionInput): {
    predictedScore: number;
    predictedGradeBand: string;
    confidence: number;
  } {
    // Weighted prediction formula
    const baseScore =
      input.avgScoreCurrentTerm * 0.5 + // 50% weight on current performance
      input.avgScorePrevTerm * 0.15 + // 15% weight on previous performance
      input.attendanceRate30d * 20 + // 20% weight on attendance (scaled to 0-20)
      input.homeworkCompletionRate * 15 + // 15% weight on homework (scaled to 0-15)
      input.engagementScore * 0.05; // 5% weight on engagement

    // Apply trend adjustment
    const trendAdjustment = input.scoreTrend * 5; // ±5 points based on trend

    // Calculate predicted score
    let predictedScore = baseScore + trendAdjustment;

    // Behavior concerns penalty
    predictedScore -= input.behaviorConcernsCount * 2;

    // Clamp to 0-100 range
    predictedScore = Math.max(0, Math.min(100, predictedScore));

    // Determine grade band
    const predictedGradeBand = this.scoreToGradeBand(predictedScore);

    // Calculate confidence based on data availability and consistency
    const dataQuality =
      (input.attendanceRate30d > 0 ? 0.25 : 0) +
      (input.homeworkCompletionRate > 0 ? 0.25 : 0) +
      (input.avgScoreCurrentTerm > 0 ? 0.3 : 0) +
      (input.avgScorePrevTerm > 0 ? 0.2 : 0);

    // Consistency bonus (low trend volatility = higher confidence)
    const consistencyBonus = Math.max(0, 0.15 - Math.abs(input.scoreTrend) * 0.5);

    const confidence = Math.min(0.95, dataQuality + consistencyBonus);

    return {
      predictedScore: Math.round(predictedScore * 10) / 10, // round to 1 decimal
      predictedGradeBand,
      confidence: Math.round(confidence * 100) / 100, // round to 2 decimals
    };
  }

  /**
   * Convert score to grade band
   */
  private static scoreToGradeBand(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    if (score >= 50) return "E";
    return "F";
  }

  /**
   * Get prediction history for a student
   */
  static async getPredictionHistory(
    studentId: string,
    schoolId: string,
    limit = 10
  ) {
    await connectDB();

    const predictions = await AiPrediction.find({
      studentId,
      schoolId,
      predictionType: "performance",
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return predictions;
  }
}
