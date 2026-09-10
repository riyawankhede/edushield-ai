#!/usr/bin/env tsx
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { StudyPlannerService } from "../src/services/study-planner.service";
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
  console.log("\n═══ TESTING AI STUDY PLANNER ═══\n");
  
  // Get a random active student
  const students = await Student.find({ isActive: true })
    .select("_id schoolId firstName lastName studentCode")
    .limit(3)
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
      const studyPlan = await StudyPlannerService.generateStudyPlan(
        student._id.toString(),
        student.schoolId.toString()
      );
      
      console.log(`\n✅ Study Plan Generated:`);
      console.log(`   Generated At: ${studyPlan.generatedAt.toISOString()}`);
      console.log(`   Total Recommended Time: ${studyPlan.totalRecommendedTime} minutes`);
      console.log(`   Number of Subjects: ${studyPlan.items.length}`);
      console.log(`\n   Recommendations:`);
      
      for (const item of studyPlan.items) {
        console.log(`\n   📚 ${item.subjectName}`);
        console.log(`      Priority: ${item.priority.toUpperCase()}`);
        console.log(`      Duration: ${item.recommendedDuration} minutes`);
        console.log(`      Focus: ${item.focusArea}`);
        console.log(`      Reason: ${item.reason}`);
        if (item.weakTopics.length > 0) {
          console.log(`      Weak Topics: ${item.weakTopics.join(", ")}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error generating study plan:`, error);
    }
  }
  
  await mongoose.disconnect();
  console.log("\n\nDisconnected.");
}

main().catch(console.error);
