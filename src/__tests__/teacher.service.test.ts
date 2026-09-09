/**
 * Tests for TeacherService.resolveTeacherByUserId (JWT-aware, school-scoped)
 *
 * - Matching userId + schoolId + isActive -> teacher returned
 * - Same userId but wrong schoolId -> not returned
 * - Inactive teacher -> not returned
 * - Unknown userId -> returns null (no NOT_FOUND throw, no first-teacher fallback)
 * - Resolver never falls back to the first active teacher / "me"
 */

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TeacherService } from "@/services/teacher.service";
import { Teacher } from "@/models";

jest.mock("@/lib/db", () => ({
  connectDB: jest.fn(async () => mongoose),
}));

const TEACHER_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e1";
const TEACHER_SCHOOL_ID = "64a1b2c3d4e5f6a7b8c9d0e2";
const OTHER_SCHOOL_ID = "64a1b2c3d4e5f6a7b8c9d0e3";
const TEACHER_2_USER_ID = "64a1b2c3d4e5f6a7b8c9d0e4";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  delete process.env.MONGODB_URI;
});

beforeEach(async () => {
  jest.restoreAllMocks();
  await Teacher.deleteMany({});
});

describe("TeacherService.resolveTeacherByUserId", () => {
  it("should return the active teacher matching userId + schoolId", async () => {
    await Teacher.create([
      {
        userId: TEACHER_USER_ID,
        schoolId: TEACHER_SCHOOL_ID,
        staffCode: "STF-101",
        firstName: "Asha",
        lastName: "Sharma",
        subjectSpecialization: "Mathematics",
        isActive: true,
      },
      {
        userId: TEACHER_2_USER_ID,
        schoolId: TEACHER_SCHOOL_ID,
        staffCode: "STF-102",
        firstName: "Ravi",
        lastName: "Patel",
        subjectSpecialization: "Science",
        isActive: true,
      },
    ]);

    const teacher = await TeacherService.resolveTeacherByUserId(
      TEACHER_USER_ID,
      TEACHER_SCHOOL_ID
    );

    expect(teacher).not.toBeNull();
    expect(teacher!.userId.toString()).toBe(TEACHER_USER_ID);
    expect(teacher!.schoolId.toString()).toBe(TEACHER_SCHOOL_ID);
  });

  it("should NOT return a teacher with the same userId but a different schoolId", async () => {
    await Teacher.create({
      userId: TEACHER_USER_ID,
      schoolId: OTHER_SCHOOL_ID,
      staffCode: "STF-103",
      firstName: "Asha",
      lastName: "Sharma",
      subjectSpecialization: "Mathematics",
      isActive: true,
    });

    const teacher = await TeacherService.resolveTeacherByUserId(
      TEACHER_USER_ID,
      TEACHER_SCHOOL_ID
    );

    expect(teacher).toBeNull();
  });

  it("should NOT return an inactive teacher", async () => {
    await Teacher.create({
      userId: TEACHER_USER_ID,
      schoolId: TEACHER_SCHOOL_ID,
      staffCode: "STF-104",
      firstName: "Asha",
      lastName: "Sharma",
      subjectSpecialization: "Mathematics",
      isActive: false,
    });

    const teacher = await TeacherService.resolveTeacherByUserId(
      TEACHER_USER_ID,
      TEACHER_SCHOOL_ID
    );

    expect(teacher).toBeNull();
  });

  it("should return null (NOT_FOUND behavior) for an unknown userId without throwing", async () => {
    await Teacher.create({
      userId: TEACHER_2_USER_ID,
      schoolId: TEACHER_SCHOOL_ID,
      staffCode: "STF-105",
      firstName: "Ravi",
      lastName: "Patel",
      subjectSpecialization: "Science",
      isActive: true,
    });
    // Do NOT create a teacher for TEACHER_USER_ID — an unrelated active
    // teacher exists, which must NOT be picked up by the resolver.

    const teacher = await TeacherService.resolveTeacherByUserId(
      TEACHER_USER_ID,
      TEACHER_SCHOOL_ID
    );

    expect(teacher).toBeNull();
  });

  it("should NOT fall back to the first active teacher or the \"me\" behavior", async () => {
    // Only ONE teacher exists — if a fallback existed it would be returned.
    await Teacher.create({
      userId: TEACHER_2_USER_ID,
      schoolId: TEACHER_SCHOOL_ID,
      staffCode: "STF-106",
      firstName: "Ravi",
      lastName: "Patel",
      subjectSpecialization: "Science",
      isActive: true,
    });

    // Lookup uses a userId that does NOT exist; the only active teacher's
    // userId differs, so a no-fallback resolver must return null.
    const teacher = await TeacherService.resolveTeacherByUserId(
      "64a1b2c3d4e5f6a7b8c9d0e9",
      TEACHER_SCHOOL_ID
    );

    expect(teacher).toBeNull();
  });
});