import fs from "fs";
import path from "path";
import { connectDB } from "../src/lib/db";
import Counselor from "../src/models/Counselor";

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

async function testCounselor() {
  await connectDB();
  console.log("Connected to MongoDB");

  const counselor = await Counselor.findOne({ isActive: true }).lean();

  if (counselor) {
    console.log("✅ Counselor found:");
    console.log({
      _id: counselor._id,
      staffCode: counselor.staffCode,
      firstName: counselor.firstName,
      lastName: counselor.lastName,
      isActive: counselor.isActive,
    });
  } else {
    console.log("❌ No active counselor found");
  }

  process.exit(0);
}

testCounselor();
