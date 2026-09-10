import fs from "fs";
import path from "path";
import { connectDB } from "../src/lib/db";
import { CounselorService } from "../src/services/counselor.service";

// Load MONGODB_URI from .env.local
function loadUri() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      if (line.startsWith("MONGODB_URI=")) {
        const uri = line.slice(12).trim().replace(/^["']|["']$/g, "");
        if (uri) return uri;
      }
    }
  }
  throw new Error("MONGODB_URI not found in .env.local");
}

process.env.MONGODB_URI = loadUri();

async function testCounselorDashboard() {
  await connectDB();
  console.log("Connected to MongoDB\n");

  try {
    const dashboard = await CounselorService.getCounselorDashboard("me");

    console.log("✅ Counselor Dashboard Data Retrieved:");
    console.log("─".repeat(60));
    console.log("Dashboard object keys:", Object.keys(dashboard));
    console.log("\nFull dashboard data:");
    console.log(JSON.stringify(dashboard, null, 2));

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }

  process.exit(0);
}

testCounselorDashboard();
