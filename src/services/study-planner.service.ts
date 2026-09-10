/**
 * Study Planner Service
 * 
 * Generates personalized study recommendations based on student academic data.
 * 
 * This service analyzes:
 * - Recent exam performance per subject
 * - Homework completion rates per subject
 * - Attendance patterns
 * - Performance trends
 * 
 * ARCHITECTURE NOTE:
 * This is a deterministic recommendation engine that produces educational
 * guidance from real student data. Recommendations are explainable and
 * prioritized based on clear academic metrics.
 */

import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import mongoose from "mongoose";
import ExamResult from "@/models/ExamResult";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Assignment from "@/models/Assignment";
import Subject from "@/models/Subject";
import Enrollment from "@/models/Enrollment";
import StudyRecommendation from "@/models/StudyRecommendation";

export type Priority = "high" | "medium" | "low";

export interface StudyPlanItem {
  subjectId: string;
  subjectName: string;
  priority: Priority;
  recommendedDuration: number; // minutes
  focusArea: string;
  reason: string;
  scoreGap?: number;
  weakTopics: string[];
}

export interface StudyPlan {
  studentId: string;
  schoolId: string;
  generatedAt: Date;
  items: StudyPlanItem[];
  totalRecommendedTime: number; // minutes
  disclaimer: string;
}

interface SubjectPerformance {
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  avgScore: number;
  examCount: number;
  homeworkCompletion: number;
  homeworkCount: number;
  scoreTrend: number;
  needsAttention: boolean;
  scoreGap: number; // distance from ideal (90%)
}

export class StudyPlannerService {
  private static readonly IDEAL_SCORE = 90;
  private static readonly HIGH_PRIORITY_THRESHOLD = 20; // gap > 20 points
  private static readonly MEDIUM_PRIORITY_THRESHOLD = 10; // gap > 10 points

  /**
   * Generate personalized study plan for a student
   */
  static async generateStudyPlan(
    studentId: string,
    schoolId: string
  ): Promise<StudyPlan> {
    await connectDB();

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw APIError.validationError("Invalid student ID");
    }
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw APIError.validationError("Invalid school ID");
    }

    const studentOid = new mongoose.Types.ObjectId(studentId);
    const schoolOid = new mongoose.Types.ObjectId(schoolId);

    // Get student's enrolled subjects
    const enrollments = await Enrollment.find({
      studentId: studentOid,
      schoolId: schoolOid,
    })
      .select("classId")
      .lean();

    if (enrollments.length === 0) {
      throw APIError.notFound("No enrollments found for student");
    }

    // Get all subjects for the school
    const subjects = await Subject.find({ schoolId: schoolOid })
      .select("_id name")
      .lean();

    // Analyze performance per subject
    const performanceData = await this.analyzeSubjectPerformance(
      studentOid,
      schoolOid,
      subjects
    );

    // Generate recommendations
    const studyPlanItems = this.generateRecommendations(performanceData);

    // Store recommendations in database
    await this.storeRecommendations(studentOid, schoolOid, studyPlanItems);

    const totalTime = studyPlanItems.reduce(
      (sum, item) => sum + item.recommendedDuration,
      0
    );

    return {
      studentId,
      schoolId,
      generatedAt: new Date(),
      items: studyPlanItems,
      totalRecommendedTime: totalTime,
      disclaimer:
        "These recommendations are AI-generated educational guidance based on your recent academic performance. Actual study needs may vary based on personal learning pace and external factors.",
    };
  }

  /**
   * Analyze student performance across subjects
   */
  private static async analyzeSubjectPerformance(
    studentId: mongoose.Types.ObjectId,
    schoolId: mongoose.Types.ObjectId,
    subjects: Array<{ _id: mongoose.Types.ObjectId; name: string }>
  ): Promise<SubjectPerformance[]> {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const performanceData: SubjectPerformance[] = [];

    for (const subject of subjects) {
      // Get recent exam results for this subject
      const [recentResults, olderResults] = await Promise.all([
        ExamResult.find({
          studentId,
          schoolId,
          subjectId: subject._id,
          createdAt: { $gte: sixtyDaysAgo },
        })
          .select("marksObtained")
          .lean(),
        ExamResult.find({
          studentId,
          schoolId,
          subjectId: subject._id,
          createdAt: { $gte: ninetyDaysAgo, $lt: sixtyDaysAgo },
        })
          .select("marksObtained")
          .lean(),
      ]);

      // Calculate average scores
      const avgScore =
        recentResults.length > 0
          ? recentResults.reduce((sum, r) => sum + r.marksObtained, 0) /
            recentResults.length
          : 70; // default

      const olderAvgScore =
        olderResults.length > 0
          ? olderResults.reduce((sum, r) => sum + r.marksObtained, 0) /
            olderResults.length
          : avgScore;

      // Calculate trend
      const scoreTrend =
        olderAvgScore > 0 ? (avgScore - olderAvgScore) / olderAvgScore : 0;

      // Get homework completion for this subject
      const assignments = await Assignment.find({
        schoolId,
        subjectId: subject._id,
        createdAt: { $gte: sixtyDaysAgo },
      })
        .select("_id")
        .lean();

      const assignmentIds = assignments.map((a) => a._id);

      const submissions = await HomeworkSubmission.find({
        studentId,
        assignmentId: { $in: assignmentIds },
        schoolId,
      })
        .select("status")
        .lean();

      const homeworkCompletion =
        assignmentIds.length > 0
          ? submissions.filter(
              (s) => s.status === "submitted" || s.status === "graded"
            ).length / assignmentIds.length
          : 0.75; // default

      // Calculate score gap from ideal
      const scoreGap = this.IDEAL_SCORE - avgScore;

      // Determine if needs attention
      const needsAttention =
        scoreGap > this.MEDIUM_PRIORITY_THRESHOLD ||
        homeworkCompletion < 0.7 ||
        scoreTrend < -0.1;

      performanceData.push({
        subjectId: subject._id,
        subjectName: subject.name,
        avgScore,
        examCount: recentResults.length,
        homeworkCompletion,
        homeworkCount: assignmentIds.length,
        scoreTrend,
        needsAttention,
        scoreGap,
      });
    }

    // Sort by needsAttention and scoreGap
    return performanceData.sort((a, b) => {
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      return b.scoreGap - a.scoreGap;
    });
  }

  /**
   * Generate study recommendations from performance data
   */
  private static generateRecommendations(
    performanceData: SubjectPerformance[]
  ): StudyPlanItem[] {
    const recommendations: StudyPlanItem[] = [];

    // Limit to top 5 subjects needing attention
    const subjectsToRecommend = performanceData.slice(0, 5);

    for (const subject of subjectsToRecommend) {
      // Determine priority
      let priority: Priority;
      if (subject.scoreGap > this.HIGH_PRIORITY_THRESHOLD) {
        priority = "high";
      } else if (subject.scoreGap > this.MEDIUM_PRIORITY_THRESHOLD) {
        priority = "medium";
      } else {
        priority = "low";
      }

      // Determine recommended duration (minutes)
      const recommendedDuration =
        priority === "high" ? 45 : priority === "medium" ? 30 : 20;

      // Generate focus area
      const focusArea = this.determineFocusArea(subject);

      // Generate reason
      const reason = this.generateReason(subject);

      // Identify weak topics (simplified - in production would use more sophisticated analysis)
      const weakTopics = this.identifyWeakTopics(subject);

      recommendations.push({
        subjectId: subject.subjectId.toString(),
        subjectName: subject.subjectName,
        priority,
        recommendedDuration,
        focusArea,
        reason,
        scoreGap: subject.scoreGap,
        weakTopics,
      });
    }

    return recommendations;
  }

  /**
   * Determine focus area based on performance patterns
   */
  private static determineFocusArea(subject: SubjectPerformance): string {
    if (subject.examCount === 0) {
      return "Review fundamental concepts and prepare for assessments";
    }

    if (subject.homeworkCompletion < 0.5) {
      return "Complete pending assignments and practice problems";
    }

    if (subject.scoreTrend < -0.15) {
      return "Review recent exam topics and clarify doubts";
    }

    if (subject.avgScore < 60) {
      return "Focus on foundational concepts and seek help from teacher";
    }

    if (subject.avgScore < 75) {
      return "Practice past exam questions and strengthen weak areas";
    }

    return "Revision and advanced problem-solving practice";
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private static generateReason(subject: SubjectPerformance): string {
    const reasons: string[] = [];

    if (subject.avgScore < 70) {
      reasons.push(
        `Current average (${Math.round(subject.avgScore)}%) is below target`
      );
    }

    if (subject.scoreTrend < -0.1) {
      reasons.push(
        `Performance declining (${Math.round(subject.scoreTrend * 100)}% trend)`
      );
    }

    if (subject.homeworkCompletion < 0.7) {
      reasons.push(
        `Homework completion rate is ${Math.round(subject.homeworkCompletion * 100)}%`
      );
    }

    if (subject.examCount === 0) {
      reasons.push("No recent exam data available");
    }

    if (reasons.length === 0) {
      reasons.push("Maintain consistent practice and revision");
    }

    return reasons[0]; // Return primary reason
  }

  /**
   * Identify weak topics (simplified for MVP)
   */
  private static identifyWeakTopics(
    subject: SubjectPerformance
  ): string[] {
    const topics: string[] = [];

    if (subject.avgScore < 60) {
      topics.push("Fundamental concepts");
      topics.push("Basic problem-solving");
    } else if (subject.avgScore < 75) {
      topics.push("Core topics review");
      topics.push("Practice exercises");
    } else {
      topics.push("Advanced topics");
      topics.push("Application problems");
    }

    return topics;
  }

  /**
   * Store recommendations in database
   */
  private static async storeRecommendations(
    studentId: mongoose.Types.ObjectId,
    schoolId: mongoose.Types.ObjectId,
    items: StudyPlanItem[]
  ) {
    const recommendations = items.map((item) => ({
      schoolId,
      studentId,
      subjectId: new mongoose.Types.ObjectId(item.subjectId),
      weakTopics: item.weakTopics,
      recommendedMaterialIds: [],
      scoreGap: item.scoreGap,
      generatedAt: new Date(),
      isViewed: false,
    }));

    // Delete old recommendations (keep only most recent)
    await StudyRecommendation.deleteMany({
      studentId,
      schoolId,
    });

    // Insert new recommendations
    if (recommendations.length > 0) {
      await StudyRecommendation.insertMany(recommendations);
    }
  }

  /**
   * Get recent study plan for a student
   */
  static async getRecentStudyPlan(
    studentId: string,
    schoolId: string
  ): Promise<StudyPlan | null> {
    await connectDB();

    const recommendations = await StudyRecommendation.find({
      studentId,
      schoolId,
    })
      .sort({ generatedAt: -1 })
      .limit(10)
      .populate("subjectId")
      .lean();

    if (recommendations.length === 0) {
      return null;
    }

    const items: StudyPlanItem[] = recommendations.map((rec: unknown) => {
      const r = rec as {
        subjectId: { _id: mongoose.Types.ObjectId; name: string };
        weakTopics: string[];
        scoreGap?: number;
      };

      // Determine priority based on scoreGap
      let priority: Priority = "low";
      if (r.scoreGap && r.scoreGap > this.HIGH_PRIORITY_THRESHOLD) {
        priority = "high";
      } else if (r.scoreGap && r.scoreGap > this.MEDIUM_PRIORITY_THRESHOLD) {
        priority = "medium";
      }

      const duration = priority === "high" ? 45 : priority === "medium" ? 30 : 20;

      return {
        subjectId: r.subjectId._id.toString(),
        subjectName: r.subjectId.name,
        priority,
        recommendedDuration: duration,
        focusArea: r.weakTopics[0] || "General review",
        reason: r.scoreGap
          ? `Score gap: ${Math.round(r.scoreGap)} points from target`
          : "Maintain consistent practice",
        scoreGap: r.scoreGap,
        weakTopics: r.weakTopics,
      };
    });

    return {
      studentId,
      schoolId,
      generatedAt: recommendations[0].generatedAt,
      items,
      totalRecommendedTime: items.reduce(
        (sum, item) => sum + item.recommendedDuration,
        0
      ),
      disclaimer:
        "These recommendations are AI-generated educational guidance based on your recent academic performance.",
    };
  }
}
