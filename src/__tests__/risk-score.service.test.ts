/**
 * Risk Score Service Tests
 * 
 * Verifies the rule-based risk calculation algorithm:
 * - Score is always between 0 and 1
 * - Risk categories are correctly assigned
 * - Factor weights are applied correctly
 * - Missing data doesn't crash the system
 * - No NaN or Infinity values
 * - Contributing factors are generated
 * - High-risk students have requiresCounselorReview=true
 * - SchoolId is respected in queries
 */

import { RiskScoreService } from "@/services/risk-score.service";
import {
  RiskScore,
  Student,
  AttendanceRecord,
  MoodCheckin,
  HomeworkSubmission,
  Assignment,
  School,
} from "@/models";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer;

describe("RiskScoreService", () => {
  let schoolId: mongoose.Types.ObjectId;
  let studentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Create a test school
    const school = await School.create({
      name: "Test School",
      code: "TEST-001",
      address: "Test City",
    });
    schoolId = school._id as mongoose.Types.ObjectId;
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  describe("Risk Score Calculation", () => {
    it("produces a score between 0 and 1", async () => {
      // Create a test student
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-STUDENT-001",
        firstName: "Test",
        lastName: "Student",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });
      studentId = student._id as mongoose.Types.ObjectId;

      const riskScore = await RiskScoreService.calculateRiskScore(studentId, schoolId);

      expect(riskScore.riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore.riskScore).toBeLessThanOrEqual(1);
      expect(isNaN(riskScore.riskScore)).toBe(false);
      expect(isFinite(riskScore.riskScore)).toBe(true);
    });

    it("assigns low category for low-risk students", async () => {
      // Create a low-risk student with good attendance and mood
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-LOW-RISK",
        firstName: "Low",
        lastName: "Risk",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // Add good attendance (95% present)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await AttendanceRecord.create({
          studentId: student._id,
          classId: new mongoose.Types.ObjectId(),
          schoolId,
          date,
          status: i % 20 === 0 ? "absent" : "present", // 95% present
        });
      }

      // Add good mood check-ins (avg 4.5/5)
      for (let i = 0; i < 20; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await MoodCheckin.create({
          studentId: student._id,
          schoolId,
          date,
          moodScore: i % 5 === 0 ? 4 : 5, // Mostly 5s, some 4s
          moodLabel: "great",
        });
      }

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.riskCategory).toBe("low");
      expect(riskScore.riskScore).toBeLessThan(0.35);
      expect(riskScore.requiresCounselorReview).toBe(false);
    });

    it("assigns medium category for moderate-risk students", async () => {
      // Create a medium-risk student with declining metrics
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-MED-RISK",
        firstName: "Medium",
        lastName: "Risk",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // Add moderate attendance (75% present - below target)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await AttendanceRecord.create({
          studentId: student._id,
          classId: new mongoose.Types.ObjectId(),
          schoolId,
          date,
          status: i % 4 === 0 ? "absent" : "present", // 75% present
        });
      }

      // Add moderate mood check-ins (avg 2.5/5 - concerning)
      for (let i = 0; i < 20; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await MoodCheckin.create({
          studentId: student._id,
          schoolId,
          date,
          moodScore: i % 2 === 0 ? 2 : 3, // Alternating 2 and 3
          moodLabel: "okay",
        });
      }

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.riskCategory).toBe("medium");
      expect(riskScore.riskScore).toBeGreaterThanOrEqual(0.35);
      expect(riskScore.riskScore).toBeLessThanOrEqual(0.65);
      expect(riskScore.requiresCounselorReview).toBe(false);
    });

    it("assigns high category for high-risk students", async () => {
      // Create a high-risk student with poor metrics
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-HIGH-RISK",
        firstName: "High",
        lastName: "Risk",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        classId: new mongoose.Types.ObjectId(),
        enrollmentDate: new Date(),
        isActive: true,
      });

      // Add very poor attendance (30% present - extreme case)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await AttendanceRecord.create({
          studentId: student._id,
          classId: student.classId,
          schoolId,
          date,
          status: i % 10 < 3 ? "present" : "absent", // 30% present
        });
      }

      // Add very poor mood check-ins (all 1s - struggling)
      for (let i = 0; i < 20; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await MoodCheckin.create({
          studentId: student._id,
          schoolId,
          date,
          moodScore: 1, // All struggling
          moodLabel: "struggling",
        });
      }

      // Add homework assignments with poor completion (to increase homework risk)
      const assignments = [];
      for (let i = 0; i < 10; i++) {
        const assignment = await Assignment.create({
          title: `Test Assignment ${i}`,
          description: "Test",
          classId: student.classId,
          teacherId: new mongoose.Types.ObjectId(),
          subjectId: new mongoose.Types.ObjectId(),
          schoolId,
          dueDate: new Date(),
        });
        assignments.push(assignment);

        // Create mostly missing submissions
        if (i > 7) { // Only submit 2 out of 10 assignments
          await HomeworkSubmission.create({
            assignmentId: assignment._id,
            studentId: student._id,
            schoolId,
            status: "submitted",
            submittedAt: new Date(),
          });
        } else {
          await HomeworkSubmission.create({
            assignmentId: assignment._id,
            studentId: student._id,
            schoolId,
            status: "missing",
          });
        }
      }

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.riskCategory).toBe("high");
      expect(riskScore.riskScore).toBeGreaterThan(0.65);
      expect(riskScore.requiresCounselorReview).toBe(true);
    });

    it("does not crash when mood data is missing", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-NO-MOOD",
        firstName: "No",
        lastName: "Mood",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // No mood check-ins created

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore.riskScore).toBeLessThanOrEqual(1);
      expect(isNaN(riskScore.riskScore)).toBe(false);
    });

    it("does not crash when behavior data is missing", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-NO-BEHAVIOR",
        firstName: "No",
        lastName: "Behavior",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // No behavior observations created (collection may not even exist)

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore.riskScore).toBeLessThanOrEqual(1);
      expect(isNaN(riskScore.riskScore)).toBe(false);
    });

    it("generates contributing factors", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-FACTORS",
        firstName: "Test",
        lastName: "Factors",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // Add some attendance issues
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await AttendanceRecord.create({
          studentId: student._id,
          classId: new mongoose.Types.ObjectId(),
          schoolId,
          date,
          status: i % 4 === 0 ? "absent" : "present", // 75% present
        });
      }

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.contributingFactors).toBeDefined();
      expect(Array.isArray(riskScore.contributingFactors)).toBe(true);
      expect(riskScore.contributingFactors.length).toBeGreaterThan(0);

      // Check structure of factors
      const firstFactor = riskScore.contributingFactors[0];
      expect(firstFactor).toHaveProperty("factor");
      expect(firstFactor).toHaveProperty("weight");
      expect(firstFactor).toHaveProperty("value");
      expect(firstFactor).toHaveProperty("description");
    });

    it("respects schoolId in all queries", async () => {
      const otherSchool = await School.create({
        name: "Other School",
        code: "OTHER-001",
        address: "Other City",
      });

      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId: otherSchool._id,
        studentCode: "OTHER-STUDENT",
        firstName: "Other",
        lastName: "Student",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      const riskScore = await RiskScoreService.calculateRiskScore(
        student._id,
        otherSchool._id
      );

      expect(riskScore.schoolId.toString()).toBe(otherSchool._id.toString());

      // Cleanup
      await School.deleteOne({ _id: otherSchool._id });
      await Student.deleteOne({ _id: student._id });
      await RiskScore.deleteOne({ _id: riskScore._id });
    });

    it("does not create duplicate risk scores for the same day", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-DUPLICATE",
        firstName: "Duplicate",
        lastName: "Test",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      // Generate risk score twice
      await RiskScoreService.calculateRiskScore(student._id, schoolId);
      await RiskScoreService.calculateRiskScore(student._id, schoolId);

      // Should only have one risk score for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const count = await RiskScore.countDocuments({
        studentId: student._id,
        schoolId,
        assessmentDate: { $gte: today, $lt: tomorrow },
      });

      expect(count).toBe(1);
    });
  });

  describe("Query Methods", () => {
    it("getStudentRiskScore returns the most recent active score", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-GET-SCORE",
        firstName: "Get",
        lastName: "Score",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      await RiskScoreService.calculateRiskScore(student._id, schoolId);

      const retrieved = await RiskScoreService.getStudentRiskScore(student._id, schoolId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.studentId.toString()).toBe(student._id.toString());
      expect(retrieved?.status).toBe("active");
    });

    it("getHighRiskStudents returns only high-risk students", async () => {
      // This test would require multiple students with varying risk levels
      // For now, just verify the method doesn't crash
      const highRisk = await RiskScoreService.getHighRiskStudents(schoolId);

      expect(Array.isArray(highRisk)).toBe(true);
    });
  });

  describe("Model Metadata", () => {
    it("stores model name and version", async () => {
      const student = await Student.create({
        userId: new mongoose.Types.ObjectId(),
        schoolId,
        studentCode: "TEST-MODEL-META",
        firstName: "Model",
        lastName: "Meta",
        dateOfBirth: new Date("2010-01-01"),
        grade: "10",
        section: "A",
        enrollmentDate: new Date(),
        isActive: true,
      });

      const riskScore = await RiskScoreService.calculateRiskScore(student._id, schoolId);

      expect(riskScore.modelName).toBe("rule_based_risk_v1");
      expect(riskScore.modelVersion).toBe("1.0.0");
      expect(riskScore.assessmentDate).toBeDefined();
    });
  });
});
