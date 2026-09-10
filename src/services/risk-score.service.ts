import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  RiskScore,
  Student,
  AttendanceRecord,
  MoodCheckin,
  HomeworkSubmission,
  Assignment,
  BehaviorObservation,
} from "@/models";
import mongoose from "mongoose";

/**
 * RiskScoreService
 * 
 * Calculates student risk scores using a transparent, rule-based algorithm.
 * 
 * Algorithm weights (from risk_train.csv):
 * - Attendance anomaly: 35%
 * - Mood severity: 28%
 * - Homework completion/drop: 22%
 * - Behavior concerns: 15%
 * 
 * All factors are normalized to [0, 1] before weighting.
 * Final riskScore is clamped to [0, 1].
 * 
 * Risk categories:
 * - high: score > 0.65
 * - medium: score > 0.35
 * - low: otherwise
 */
export class RiskScoreService {
  /**
   * Calculate risk score for a single student
   */
  static async calculateRiskScore(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    // Verify student exists
    const student = await Student.findOne({
      _id: studentId,
      schoolId,
      isActive: true,
    }).lean();

    if (!student) {
      throw APIError.notFound("Student not found");
    }

    // Calculate individual risk factors
    const attendanceRisk = await this.calculateAttendanceRisk(studentId, schoolId);
    const moodRisk = await this.calculateMoodRisk(studentId, schoolId);
    const homeworkRisk = await this.calculateHomeworkRisk(studentId, schoolId);
    const behaviorRisk = await this.calculateBehaviorRisk(studentId, schoolId);

    // Apply weights (from training data)
    const weights = {
      attendance: 0.35,
      mood: 0.28,
      homework: 0.22,
      behavior: 0.15,
    };

    const rawScore =
      weights.attendance * attendanceRisk +
      weights.mood * moodRisk +
      weights.homework * homeworkRisk +
      weights.behavior * behaviorRisk;

    // Clamp to [0, 1] and handle edge cases
    const riskScore = Math.min(1, Math.max(0, isNaN(rawScore) ? 0 : rawScore));

    // Determine category
    let riskCategory: "low" | "medium" | "high";
    if (riskScore > 0.65) {
      riskCategory = "high";
    } else if (riskScore > 0.35) {
      riskCategory = "medium";
    } else {
      riskCategory = "low";
    }

    // Generate contributing factors
    const contributingFactors = await this.generateContributingFactors({
      studentId,
      schoolId,
      attendanceRisk,
      moodRisk,
      homeworkRisk,
      behaviorRisk,
      weights,
    });

    // Create or update risk score
    const assessmentDate = new Date();
    const riskScoreData = {
      studentId,
      schoolId,
      riskScore,
      riskCategory,
      contributingFactors,
      modelName: "rule_based_risk_v1",
      modelVersion: "1.0.0",
      assessmentDate,
      status: "active" as const,
      requiresCounselorReview: riskCategory === "high",
    };

    // Upsert: update if exists for today, create if not
    const startOfDay = new Date(assessmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(assessmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingScore = await RiskScore.findOne({
      studentId,
      schoolId,
      assessmentDate: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingScore) {
      Object.assign(existingScore, riskScoreData);
      await existingScore.save();
      return existingScore;
    } else {
      return await RiskScore.create(riskScoreData);
    }
  }

  /**
   * Calculate attendance risk (0-1, higher = more risk)
   * 
   * Looks at last 30 days of attendance.
   * Absence/late increases risk, present decreases it.
   */
  private static async calculateAttendanceRisk(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await AttendanceRecord.find({
      studentId,
      schoolId,
      date: { $gte: thirtyDaysAgo },
    }).lean();

    if (records.length === 0) {
      // No data = assume moderate risk
      return 0.4;
    }

    const presentCount = records.filter((r) => r.status === "present").length;
    const absentCount = records.filter((r) => r.status === "absent").length;
    const totalRecords = records.length;

    // Calculate attendance rate
    const attendanceRate = presentCount / totalRecords;

    // Target attendance rate is 0.92 (92%)
    const targetRate = 0.92;

    // Convert to risk: lower attendance = higher risk
    // If attendance is 100%, risk = 0
    // If attendance is 0%, risk = 1
    // If attendance matches target (92%), risk = ~0.2
    let risk = 1 - attendanceRate / targetRate;

    // Add penalty for absences vs excused
    const absenceRatio = absentCount / totalRecords;
    risk += absenceRatio * 0.2;

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, risk));
  }

  /**
   * Calculate mood risk (0-1, higher = more risk)
   * 
   * Looks at last 30 days of mood check-ins.
   * Lower mood scores indicate higher risk.
   */
  private static async calculateMoodRisk(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const moodCheckins = await MoodCheckin.find({
      studentId,
      schoolId,
      date: { $gte: thirtyDaysAgo },
    })
      .sort({ date: -1 })
      .lean();

    if (moodCheckins.length === 0) {
      // No mood data = assume low-moderate risk
      return 0.3;
    }

    // Calculate average mood (scale 1-5, where 1 is struggling)
    const avgMood =
      moodCheckins.reduce((sum, m) => sum + m.moodScore, 0) / moodCheckins.length;

    // Count low mood days (score <= 2)
    const lowMoodCount = moodCheckins.filter((m) => m.moodScore <= 2).length;
    const lowMoodRatio = lowMoodCount / moodCheckins.length;

    // Convert to risk
    // If avg mood is 5 (great), risk = 0
    // If avg mood is 1 (struggling), risk = 1
    // If avg mood is 4.2 (baseline), risk = ~0.2
    const moodRisk = (5 - avgMood) / 4; // Normalize from 1-5 scale to 0-1

    // Add penalty for frequent low mood days
    const lowMoodPenalty = lowMoodRatio * 0.3;

    const totalRisk = moodRisk + lowMoodPenalty;

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, totalRisk));
  }

  /**
   * Calculate homework risk (0-1, higher = more risk)
   * 
   * Looks at homework completion rate.
   * Lower completion indicates higher risk.
   */
  private static async calculateHomeworkRisk(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    // Get all assignments assigned to this student's class
    const student = await Student.findById(studentId).select("classId").lean();
    if (!student || !student.classId) {
      return 0.3; // No class data = assume moderate risk
    }

    // Get assignments for this student
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const assignments = await Assignment.find({
      classId: student.classId,
      schoolId,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .select("_id")
      .lean();

    if (assignments.length === 0) {
      return 0.2; // No assignments = assume low risk
    }

    const assignmentIds = assignments.map((a) => a._id);

    // Get submissions for this student
    const submissions = await HomeworkSubmission.find({
      studentId,
      schoolId,
      assignmentId: { $in: assignmentIds },
    }).lean();

    const submittedCount = submissions.filter(
      (s) => s.status === "submitted" || s.status === "graded"
    ).length;
    const missingCount = submissions.filter((s) => s.status === "missing").length;

    const totalAssignments = assignments.length;

    // Calculate completion rate
    const completionRate = submittedCount / totalAssignments;

    // Target completion rate is 0.92 (92%)
    const targetRate = 0.92;

    // Convert to risk
    let risk = 1 - completionRate / targetRate;

    // Add penalty for missing assignments
    const missingRatio = missingCount / totalAssignments;
    risk += missingRatio * 0.25;

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, risk));
  }

  /**
   * Calculate behavior risk (0-1, higher = more risk)
   * 
   * Counts behavior concerns in last 30 days.
   */
  private static async calculateBehaviorRisk(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const concerns = await BehaviorObservation.countDocuments({
        studentId,
        schoolId,
        type: "concern",
        observationDate: { $gte: thirtyDaysAgo },
      });

      // 0 concerns = 0 risk
      // 1-2 concerns = low risk
      // 3-4 concerns = medium risk
      // 5+ concerns = high risk
      if (concerns === 0) return 0;
      if (concerns <= 2) return 0.25;
      if (concerns <= 4) return 0.55;
      return Math.min(1, 0.75 + (concerns - 5) * 0.1);
    } catch {
      // If BehaviorObservation collection doesn't exist or query fails,
      // safely return 0 (no behavior risk)
      return 0;
    }
  }

  /**
   * Generate human-readable contributing factors
   */
  private static async generateContributingFactors(params: {
    studentId: string | mongoose.Types.ObjectId;
    schoolId: string | mongoose.Types.ObjectId;
    attendanceRisk: number;
    moodRisk: number;
    homeworkRisk: number;
    behaviorRisk: number;
    weights: {
      attendance: number;
      mood: number;
      homework: number;
      behavior: number;
    };
  }) {
    const {
      studentId,
      schoolId,
      attendanceRisk,
      moodRisk,
      homeworkRisk,
      behaviorRisk,
      weights,
    } = params;

    const factors = [];

    // Attendance factor
    if (attendanceRisk > 0.1) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const records = await AttendanceRecord.find({
        studentId,
        schoolId,
        date: { $gte: thirtyDaysAgo },
      }).lean();

      const presentCount = records.filter((r) => r.status === "present").length;
      const rate = records.length > 0 ? (presentCount / records.length) * 100 : 0;

      factors.push({
        factor: "Attendance",
        weight: weights.attendance,
        value: `${Math.round(rate)}%`,
        description:
          attendanceRisk > 0.5
            ? "Attendance has declined significantly"
            : attendanceRisk > 0.3
            ? "Attendance is below expected level"
            : "Attendance shows minor concerns",
      });
    }

    // Mood factor
    if (moodRisk > 0.1) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const moodCheckins = await MoodCheckin.find({
        studentId,
        schoolId,
        date: { $gte: thirtyDaysAgo },
      }).lean();

      const avgMood =
        moodCheckins.length > 0
          ? moodCheckins.reduce((sum, m) => sum + m.moodScore, 0) / moodCheckins.length
          : 3;

      factors.push({
        factor: "Mood & Well-being",
        weight: weights.mood,
        value: `${avgMood.toFixed(1)}/5`,
        description:
          moodRisk > 0.5
            ? "Recent mood scores indicate significant concern"
            : moodRisk > 0.3
            ? "Mood scores are below typical levels"
            : "Mood shows minor fluctuations",
      });
    }

    // Homework factor
    if (homeworkRisk > 0.1) {
      const student = await Student.findById(studentId).select("classId").lean();
      if (student?.classId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const assignments = await Assignment.find({
          classId: student.classId,
          schoolId,
          createdAt: { $gte: thirtyDaysAgo },
        })
          .select("_id")
          .lean();

        if (assignments.length > 0) {
          const submissions = await HomeworkSubmission.find({
            studentId,
            schoolId,
            assignmentId: { $in: assignments.map((a) => a._id) },
          }).lean();

          const submittedCount = submissions.filter(
            (s) => s.status === "submitted" || s.status === "graded"
          ).length;
          const rate = (submittedCount / assignments.length) * 100;

          factors.push({
            factor: "Homework Completion",
            weight: weights.homework,
            value: `${Math.round(rate)}%`,
            description:
              homeworkRisk > 0.5
                ? "Homework completion has dropped significantly"
                : homeworkRisk > 0.3
                ? "Homework completion is below expected level"
                : "Homework completion shows minor concerns",
          });
        }
      }
    }

    // Behavior factor
    if (behaviorRisk > 0.1) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      try {
        const concerns = await BehaviorObservation.countDocuments({
          studentId,
          schoolId,
          type: "concern",
          observationDate: { $gte: thirtyDaysAgo },
        });

        if (concerns > 0) {
          factors.push({
            factor: "Behavioral Concerns",
            weight: weights.behavior,
            value: concerns,
            description:
              concerns > 4
                ? "Multiple behavioral concerns recorded recently"
                : concerns > 2
                ? "Some behavioral concerns noted"
                : "Minor behavioral observations recorded",
          });
        }
      } catch {
        // Silently skip if behavior observations don't exist
      }
    }

    return factors;
  }

  /**
   * Get risk score for a single student
   */
  static async getStudentRiskScore(
    studentId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    const riskScore = await RiskScore.findOne({
      studentId,
      schoolId,
      status: "active",
    })
      .sort({ assessmentDate: -1 })
      .lean();

    return riskScore;
  }

  /**
   * Get risk scores for all students in a class
   */
  static async getRiskScoresForClass(
    classId: string | mongoose.Types.ObjectId,
    schoolId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    // Get all students in the class
    const students = await Student.find({
      classId,
      schoolId,
      isActive: true,
    })
      .select("_id firstName lastName studentCode")
      .lean();

    const studentIds = students.map((s) => s._id);

    // Get risk scores for these students
    const riskScores = await RiskScore.find({
      studentId: { $in: studentIds },
      schoolId,
      status: "active",
    })
      .sort({ assessmentDate: -1 })
      .lean();

    // Combine student info with risk scores
    const results = students.map((student) => {
      const risk = riskScores.find(
        (r) => r.studentId.toString() === student._id.toString()
      );
      return {
        student,
        riskScore: risk || null,
      };
    });

    return results;
  }

  /**
   * Get all high-risk students in a school
   */
  static async getHighRiskStudents(schoolId: string | mongoose.Types.ObjectId) {
    await connectDB();

    const highRiskScores = await RiskScore.find({
      schoolId,
      riskCategory: "high",
      status: "active",
    })
      .sort({ riskScore: -1 })
      .populate("studentId", "firstName lastName studentCode grade section")
      .lean();

    return highRiskScores;
  }

  /**
   * Generate risk scores for all active students in a school
   * (Used during seed/demo data generation)
   */
  static async generateRiskScoresForSchool(
    schoolId: string | mongoose.Types.ObjectId
  ) {
    await connectDB();

    const students = await Student.find({
      schoolId,
      isActive: true,
    })
      .select("_id")
      .lean();

    console.log(`Generating risk scores for ${students.length} students...`);

    const results = {
      total: students.length,
      success: 0,
      failed: 0,
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const student of students) {
      try {
        const riskScore = await this.calculateRiskScore(student._id, schoolId);
        results.success++;

        if (riskScore.riskCategory === "low") results.low++;
        else if (riskScore.riskCategory === "medium") results.medium++;
        else if (riskScore.riskCategory === "high") results.high++;
      } catch (error) {
        results.failed++;
        console.error(`Failed to calculate risk for student ${student._id}:`, error);
      }
    }

    console.log("Risk score generation complete:", results);
    return results;
  }
}
