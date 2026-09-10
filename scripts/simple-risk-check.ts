#!/usr/bin/env tsx
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import RiskScore from "../src/models/RiskScore";

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
  await mongoose.connect(uri);
  
  console.log("Connected to:", mongoose.connection.name);
  
  // Check all risk scores first
  const totalCount = await RiskScore.countDocuments();
  console.log(`Total RiskScore documents in DB: ${totalCount}`);
  
  const allRiskScores = await RiskScore.find({}).lean();
  console.log(`Found ${allRiskScores.length} risk scores via .find({})`);
  
  if (allRiskScores.length === 0) {
    console.log("No risk scores found. Exiting.");
    await mongoose.disconnect();
    return;
  }
  
  const active = allRiskScores.filter(r => (r as { isActive?: boolean }).isActive !== false);
  console.log(`Active risk scores: ${active.length}`);
  
  const low = active.filter(r => r.riskCategory === "low");
  const medium = active.filter(r => r.riskCategory === "medium");
  const high = active.filter(r => r.riskCategory === "high");
  
  const total = active.length;
  
  console.log("\n═══ RISK SCORE DISTRIBUTION ═══\n");
  console.log(`Total Risk Scores: ${total}`);
  console.log(`Low:    ${low.length} (${((low.length / total) * 100).toFixed(1)}%)`);
  console.log(`Medium: ${medium.length} (${((medium.length / total) * 100).toFixed(1)}%)`);
  console.log(`High:   ${high.length} (${((high.length / total) * 100).toFixed(1)}%)`);
  console.log(`\nRequiring counselor review: ${active.filter(r => r.requiresCounselorReview).length}`);
  
  // Score statistics
  const scores = active.map(r => r.riskScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  console.log(`\n═══ SCORE STATISTICS ═══\n`);
  console.log(`Min score: ${(min * 100).toFixed(2)}%`);
  console.log(`Max score: ${(max * 100).toFixed(2)}%`);
  console.log(`Avg score: ${(avg * 100).toFixed(2)}%`);
  
  // High risk students detail
  if (high.length > 0) {
    console.log(`\n═══ HIGH RISK STUDENTS (${high.length}) ═══\n`);
    for (const student of high) {
      const s = student as { studentId: unknown; riskScore: number; attendanceRisk?: number; moodRisk?: number; homeworkRisk?: number; behaviorRisk?: number };
      console.log(`Student ID: ${s.studentId}`);
      console.log(`  Risk Score: ${(s.riskScore * 100).toFixed(2)}%`);
      console.log(`  Attendance Risk: ${s.attendanceRisk ? (s.attendanceRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Mood Risk: ${s.moodRisk ? (s.moodRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Homework Risk: ${s.homeworkRisk ? (s.homeworkRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Behavior Risk: ${s.behaviorRisk ? (s.behaviorRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log();
    }
  }
  
  // Sample medium risk students
  if (medium.length > 0) {
    console.log(`\n═══ SAMPLE MEDIUM RISK STUDENTS (showing 5) ═══\n`);
    for (let i = 0; i < Math.min(5, medium.length); i++) {
      const student = medium[i];
      const s = student as { studentId: unknown; riskScore: number; attendanceRisk?: number; moodRisk?: number; homeworkRisk?: number; behaviorRisk?: number };
      console.log(`Student ID: ${s.studentId}`);
      console.log(`  Risk Score: ${(s.riskScore * 100).toFixed(2)}%`);
      console.log(`  Attendance Risk: ${s.attendanceRisk ? (s.attendanceRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Mood Risk: ${s.moodRisk ? (s.moodRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Homework Risk: ${s.homeworkRisk ? (s.homeworkRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log(`  Behavior Risk: ${s.behaviorRisk ? (s.behaviorRisk * 100).toFixed(2) : 'N/A'}%`);
      console.log();
    }
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
