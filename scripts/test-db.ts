/**
 * scripts/test-db.ts
 *
 * Quick integration test for the MongoDB connection + Mongoose models.
 * Usage:
 *   npx tsx scripts/test-db.ts                           # reads MONGODB_URI from .env.local or .env
 *   npx tsx scripts/test-db.ts "mongodb+srv://..."       # pass URI directly as first arg
 */

import path from "path";
import fs from "fs";
import mongoose from "mongoose";

// ── Load env files if no direct arg supplied ────────────────────────────────
function loadEnv(): string {
  const root = path.resolve(__dirname, "..");

  // Check CLI arg first
  const cliArg = process.argv[2];
  if (cliArg && cliArg.startsWith("mongodb")) {
    return cliArg;
  }

  // Try .env.local then .env
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(root, filename);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("MONGODB_URI=")) {
          const uri = trimmed.slice("MONGODB_URI=".length).replace(/^["']|["']$/g, "");
          if (uri && !uri.includes("<") && !uri.includes("your_")) {
            console.log(`✔  Loaded MONGODB_URI from ${filename}`);
            return uri;
          }
        }
      }
    }
  }

  // Fall back to process.env
  if (process.env.MONGODB_URI) {
    console.log("✔  Using MONGODB_URI from process.env");
    return process.env.MONGODB_URI;
  }

  throw new Error(
    "No MONGODB_URI found.\n" +
      "  Option 1: Set MONGODB_URI in .env.local\n" +
      "  Option 2: npx tsx scripts/test-db.ts \"mongodb+srv://...\""
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const uri = loadEnv();

  console.log("\n=== EduShield DB Connection Test ===\n");

  // 1. Connect
  console.log("1/5  Connecting to MongoDB Atlas…");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("     ✔ Connected. DB:", mongoose.connection.db?.databaseName ?? "(unknown)");

  // 2. Import School model (simplest schema, no foreign key deps)
  const { School } = await import("../src/models/index");

  // 3. Insert a test document
  console.log("2/5  Inserting test school document…");
  const testSchool = await School.create({
    name: "__DB_TEST_SCHOOL__",
    code: "TEST_SCH_001",
    address: "123 Test Lane",
    phone: "000-000-0000",
    email: "test@test.com",
    principalName: "Test Principal",
    timezone: "Asia/Kolkata",
    isActive: true,
  });
  console.log("     ✔ Inserted _id:", testSchool._id.toString());

  // 4. Read back
  console.log("3/5  Reading document back…");
  const found = await School.findById(testSchool._id).lean();
  if (!found) throw new Error("Document not found after insert!");
  console.log("     ✔ Found:", (found as { name: string }).name);

  // 5. Delete test document
  console.log("4/5  Cleaning up…");
  await School.deleteOne({ _id: testSchool._id });
  const gone = await School.findById(testSchool._id).lean();
  if (gone) throw new Error("Document still exists after delete!");
  console.log("     ✔ Test document removed.");

  // 6. Model count smoke-check
  console.log("5/5  Verifying all models register without error…");
  const allModels = await import("../src/models/index");
  // Count exported names (rough check — excludes non-model re-exports like interfaces)
  const modelCount = Object.keys(allModels).length;
  console.log(`     ✔ ${modelCount} named exports found in src/models/index.ts`);

  console.log("\n✅ All tests passed! Database connection and models are working correctly.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err.message ?? err);
  process.exit(1);
});
