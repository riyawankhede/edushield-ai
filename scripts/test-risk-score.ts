/**
 * Test script to verify risk score calculation works with seeded data
 * Usage: npx tsx scripts/test-risk-score.ts
 */

import { connectDB } from "../src/lib/db";
import { RiskScoreService } from "../src/services/risk-score.service";
import { Student, School } from "../src/models";

async function main() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await connectDB();

    // Get first school and student
    const school = await School.findOne({}).lean();
    if (!school) {
      console.log("❌ No schools found. Run npm run seed first.");
      process.exit(1);
    }

    const students = await Student.find({ schoolId: school._id, isActive: true })
      .limit(3)
      .lean();

    if (students.length === 0) {
      console.log("❌ No students found. Run npm run seed first.");
      process.exit(1);
    }

    console.log(`📊 Testing risk score calculation for ${students.length} students...`);

    for (const student of students) {
      console.log(`\n👤 Calculating risk for: ${student.firstName} ${student.lastName}`);

      try {
        const riskScore = await RiskScoreService.calculateRiskScore(
          student._id,
          school._id
        );

        console.log(`   Risk Score: ${riskScore.riskScore.toFixed(3)}`);
        console.log(`   Category: ${riskScore.riskCategory}`);
        console.log(`   Requires Counselor Review: ${riskScore.requiresCounselorReview}`);
        console.log(`   Contributing Factors: ${riskScore.contributingFactors.length}`);

        // Show first 2 factors
        riskScore.contributingFactors.slice(0, 2).forEach((factor, i) => {
          console.log(`   ${i + 1}. ${factor.factor}: ${factor.value} (${factor.description})`);
        });
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test high-risk query
    console.log(`\n🚨 High-risk students in school:`);
    const highRisk = await RiskScoreService.getHighRiskStudents(school._id);
    console.log(`   Found: ${highRisk.length} high-risk students`);

    console.log("\n✅ Risk score system is working!");
    process.exit(0);
  } catch (error) {
    console.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();