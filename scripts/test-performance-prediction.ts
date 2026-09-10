#!/usr/bin/env tsx
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { PerformancePredictionService } from "../src/services/performance-prediction.service";
import Student from "../src/models/Student";

function resolveUri(): string {
  for (const filename of [".env.local", ".env"]) {
    const p = path.resolve(__dirname, "..", filename);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        if (line.startsWith("MONGODB_URI=")) {
          return line.substring("MONGODB_URI=".length).trim().replace(/"/g, "");
        }
      }
    }
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error("No MONGODB_URI found. Set it in .env.local");
}

async function main() {
  const uri = resolveUri();
  
  // Set environment variable for services that use connectDB()
  process.env.MONGODB_URI = uri;
  
  await mongoose.connect(uri);
  
  console.log("Connected to:", mongoose.connection.name);
  console.log("\n═══ TESTING PERFORMANCE PREDICTION ═══\n");
  
  // Get a random active student
  const students = await Student.find({ isActive: true })
    .select("_id schoolId firstName lastName studentCode")
    .limit(5)
    .lean();
  
  if (students.length === 0) {
    console.log("No active students found");
    await mongoose.disconnect();
    return;
  }
  
  console.log(`Testing with ${students.length} students...\n`);
  
  for (const student of students) {
    console.log(`\n─── Student: ${student.firstName} ${student.lastName} (${student.studentCode}) ───`);
    console.log(`Student ID: ${student._id}`);
    console.log(`School ID: ${student.schoolId}`);
    
    try {
      const prediction = await PerformancePredictionService.predictStudentPerformance(
        student._id.toString(),
        student.schoolId.toString()
      );
      
      console.log(`\n✅ Prediction Generated:`);
      console.log(`   Predicted Score: ${prediction.predictedScore}%`);
      console.log(`   Grade Band: ${prediction.predictedGradeBand}`);
      console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      console.log(`\n   Input Features:`);
      console.log(`   - Attendance (30d): ${(prediction.inputFeatures.attendanceRate30d * 100).toFixed(1)}%`);
      console.log(`   - Attendance (90d): ${(prediction.inputFeatures.attendanceRate90d * 100).toFixed(1)}%`);
      console.log(`   - Homework Completion: ${(prediction.inputFeatures.homeworkCompletionRate * 100).toFixed(1)}%`);
      console.log(`   - Current Term Avg: ${prediction.inputFeatures.avgScoreCurrentTerm.toFixed(1)}%`);
      console.log(`   - Previous Term Avg: ${prediction.inputFeatures.avgScorePrevTerm.toFixed(1)}%`);
      console.log(`   - Score Trend: ${(prediction.inputFeatures.scoreTrend * 100).toFixed(1)}%`);
      console.log(`   - Engagement Score: ${prediction.inputFeatures.engagementScore.toFixed(1)}`);
      console.log(`\n   Model: ${prediction.modelName} (${prediction.modelVersion})`);
    } catch (error) {
      console.error(`❌ Error generating prediction:`, error);
    }
  }
  
  await mongoose.disconnect();
  console.log("\n\nDisconnected.");
}

main().catch(console.error);
