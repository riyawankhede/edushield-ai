/**
 * scripts/seed.ts
 *
 * Phase 3 — Seed Script
 * Reads all CSVs from data/seed/ and inserts them into MongoDB using the
 * Mongoose models from Phase 2.
 *
 * Strategy: DROP + RECREATE (idempotent — run twice, same result)
 * Batch size: 1000 documents per insertMany call
 *
 * Dependency order:
 *   School → User (admin/teacher/parent/student users) → Subject → Class
 *   → Teacher → Student → Parent → ParentStudentRelationship
 *   → TeacherClassAssignment → Enrollment
 *   → Assignment → Exam
 *   → AttendanceRecord → HomeworkSubmission → ExamResult
 *   → MoodCheckin
 *   → SafetyReport → SafetyIncident
 *   → Bus
 *
 * Usage:
 *   npm run seed                        # reads MONGODB_URI from .env.local
 *   npx tsx scripts/seed.ts "mongodb+srv://..."
 */

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";
import { hashPassword } from "../src/lib/password";

// ── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000;
const SEED_DIR = path.resolve(__dirname, "../data/seed");

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  grey: "\x1b[90m",
};
const log = {
  info: (msg: string) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  ok: (msg: string) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  err: (msg: string) => console.error(`${c.red}✖${c.reset}  ${msg}`),
  section: (msg: string) =>
    console.log(`\n${c.bold}${c.cyan}── ${msg} ──${c.reset}`),
};

// ── Env loader ────────────────────────────────────────────────────────────────
function resolveUri(): string {
  const cli = process.argv[2];
  if (cli && cli.startsWith("mongodb")) return cli;
  for (const filename of [".env.local", ".env"]) {
    const p = path.resolve(__dirname, "..", filename);
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
        if (line.startsWith("MONGODB_URI=")) {
          const uri = line.slice(12).trim().replace(/^["']|["']$/g, "");
          if (uri && !uri.includes("<") && !uri.includes("your_")) return uri;
        }
      }
    }
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error(
    "No MONGODB_URI found. Set it in .env.local or pass as CLI arg."
  );
}

// ── CSV loader ────────────────────────────────────────────────────────────────
function loadCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(SEED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    log.warn(`CSV not found, skipping: ${filename}`);
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

// ── Batch inserter ────────────────────────────────────────────────────────────
async function batchInsert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: mongoose.Model<any>,
  docs: object[],
  label: string
): Promise<number> {
  if (docs.length === 0) {
    log.warn(`  ${label}: 0 docs — skipping`);
    return 0;
  }
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await model.insertMany(batch, { ordered: false });
    inserted += batch.length;
    if (docs.length > BATCH_SIZE) {
      process.stdout.write(
        `\r  ${label}: ${inserted.toLocaleString()} / ${docs.length.toLocaleString()} inserted...`
      );
    }
  }
  if (docs.length > BATCH_SIZE) process.stdout.write("\n");
  log.ok(`  ${label}: ${inserted.toLocaleString()} documents inserted`);
  return inserted;
}

// ── Drop collections ──────────────────────────────────────────────────────────
async function dropCollections(names: string[]): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB connection");
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of names) {
    if (existing.includes(name)) {
      await db.dropCollection(name);
      log.info(`  Dropped collection: ${name}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n${c.bold}EduShield AI — Seed Script (Phase 3)${c.reset}`
  );
  console.log(`${c.grey}Strategy: DROP + RECREATE | Batch size: ${BATCH_SIZE}${c.reset}\n`);

  const uri = resolveUri();

  // Set MONGODB_URI in process.env for compatibility with connectDB() in services
  // This ensures that any service (e.g., RiskScoreService) that calls connectDB()
  // will find the required environment variable and use the existing Mongoose connection
  process.env.MONGODB_URI = uri;

  log.info("Connecting to MongoDB Atlas...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  log.ok(`Connected to DB: ${mongoose.connection.db?.databaseName}`);

  // Generate a real bcrypt hash for demo accounts.
  // All seeded users share this password for hackathon / development use.
  // NEVER use this pattern in production — production accounts must have
  // individual, user-chosen passwords.
  log.info("Generating demo password hash (bcrypt, cost 12)…");
  const DEMO_PASSWORD_HASH = await hashPassword("Password123!");
  log.ok("  Demo password hash ready");

  // Import all models (must be after connect for hot-reload safety)
  const {
    School,
    User,
    Subject,
    Class,
    Teacher,
    Student,
    Parent,
    ParentStudentRelationship,
    TeacherClassAssignment,
    Enrollment,
    Assignment,
    Exam,
    ExamResult,
    AttendanceRecord,
    HomeworkSubmission,
    MoodCheckin,
    SafetyReport,
    SafetyIncident,
    Bus,
    Counselor,
  } = await import("../src/models/index");

  // ── ID maps: CSV natural key → MongoDB ObjectId ─────────────────────────────
  const idMap = {
    school: new Map<string, mongoose.Types.ObjectId>(),
    class: new Map<string, mongoose.Types.ObjectId>(),
    subject: new Map<string, mongoose.Types.ObjectId>(),
    student: new Map<string, mongoose.Types.ObjectId>(),
    teacher: new Map<string, mongoose.Types.ObjectId>(),
    parent: new Map<string, mongoose.Types.ObjectId>(),
    counselor: new Map<string, mongoose.Types.ObjectId>(),
    user: new Map<string, mongoose.Types.ObjectId>(), // keyed by email
    exam: new Map<string, mongoose.Types.ObjectId>(),
    assignment: new Map<string, mongoose.Types.ObjectId>(),
    bus: new Map<string, mongoose.Types.ObjectId>(),
  };

  // ── Collections to drop (in reverse dependency order) ────────────────────────
  log.section("Dropping existing collections");
  await dropCollections([
    "homework_submissions",
    "exam_results",
    "attendance_records",
    "mood_checkins",
    "safety_reports",
    "safety_incidents",
    "enrollments",
    "teacher_class_assignments",
    "parent_student_relationships",
    "exams",
    "assignments",
    "students",
    "parents",
    "teachers",
    "counselors",
    "buses",
    "classes",
    "subjects",
    "users",
    "schools",
  ]);

  const summary: Record<string, number> = {};

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 1: School (anchor — everything else references it)
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 1: School");

  const schoolDoc = await School.create({
    name: "EduShield Demo School",
    code: "SCH001",
    address: "12 Knowledge Park, New Delhi, India — 110001",
    contactEmail: "admin@edushield.org",
    contactPhone: "+91 11 2345 6789",
    academicYearCurrent: "2025-26",
    isActive: true,
  });
  idMap.school.set("SCH-001", schoolDoc._id as mongoose.Types.ObjectId);
  log.ok(`  School: 1 document inserted (_id: ${schoolDoc._id})`);
  summary["schools"] = 1;

  const schoolId = idMap.school.get("SCH-001")!;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 2: Subjects & Classes (no inter-dependency)
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 2: Subjects & Classes");

  // Subjects
  const subjectRows = loadCsv("subjects.csv");
  const subjectDocs = subjectRows.map((r) => ({
    schoolId,
    name: r.name,
    code: r.code,
    gradeLevel: r.gradeLevel || undefined,
    isActive: true,
  }));
  const insertedSubjects = await Subject.insertMany(subjectDocs, {
    ordered: true,
  });
  insertedSubjects.forEach((doc, i) => {
    idMap.subject.set(subjectRows[i].subjectId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Subjects: ${insertedSubjects.length} documents inserted`);
  summary["subjects"] = insertedSubjects.length;

  // Classes
  const classRows = loadCsv("classes.csv");
  const classDocs = classRows.map((r) => ({
    schoolId,
    name: r.name,
    grade: r.grade,
    section: r.section,
    academicYear: r.academicYear,
    roomNumber: r.roomNumber || undefined,
    isActive: true,
  }));
  const insertedClasses = await Class.insertMany(classDocs, { ordered: true });
  insertedClasses.forEach((doc, i) => {
    idMap.class.set(classRows[i].classId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Classes: ${insertedClasses.length} documents inserted`);
  summary["classes"] = insertedClasses.length;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 3: Users + Teacher / Student / Parent profile docs
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 3: Users & Profiles");

  // ── Admin user (synthetic — not in CSV) ─────────────────────────────────────
  const adminUserDoc = await User.create({
    email: "admin@edushield.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "admin",
    schoolId,
    isActive: true,
  });
  idMap.user.set("admin@edushield.org", adminUserDoc._id as mongoose.Types.ObjectId);
  log.ok(`  Admin user: 1 inserted`);

  // ── Counselor user (synthetic — not in CSV) ──────────────────────────────────
  const counselorUserDoc = await User.create({
    email: "counselor@edushield.org",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "counselor",
    schoolId,
    isActive: true,
  });
  idMap.user.set("counselor@edushield.org", counselorUserDoc._id as mongoose.Types.ObjectId);

  const counselorProfileDoc = await Counselor.create({
    userId: counselorUserDoc._id,
    schoolId,
    staffCode: "CNS-001",
    firstName: "Dr. Priya",
    lastName: "Sharma",
    phone: "+91-9876543210",
    qualification: "M.A. Psychology, Licensed Counselor",
    isActive: true,
  });
  idMap.counselor.set("CNS-001", counselorProfileDoc._id as mongoose.Types.ObjectId);
  log.ok(`  Counselor user: 1 profile + 1 user inserted`);

  // ── Teachers ─────────────────────────────────────────────────────────────────
  const teacherRows = loadCsv("teachers.csv");
  const teacherUserDocs = teacherRows.map((r) => ({
    email: r.email,
    passwordHash: DEMO_PASSWORD_HASH,
    role: "teacher" as const,
    schoolId,
    isActive: r.isActive === "True",
  }));
  const insertedTeacherUsers = await User.insertMany(teacherUserDocs, {
    ordered: true,
  });
  insertedTeacherUsers.forEach((doc, i) => {
    idMap.user.set(teacherRows[i].email, doc._id as mongoose.Types.ObjectId);
  });

  const teacherProfileDocs = teacherRows.map((r, i) => ({
    userId: insertedTeacherUsers[i]._id,
    schoolId,
    staffCode: r.staffCode,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone || undefined,
    qualification: r.qualification || undefined,
    specializations: r.subjectSpecialization ? [r.subjectSpecialization] : [],
    subjectSpecialization: r.subjectSpecialization || undefined,
    isActive: r.isActive === "True",
  }));
  const insertedTeachers = await Teacher.insertMany(teacherProfileDocs, {
    ordered: true,
  });
  insertedTeachers.forEach((doc, i) => {
    idMap.teacher.set(teacherRows[i].teacherId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Teachers: ${insertedTeachers.length} profiles + ${insertedTeacherUsers.length} users inserted`);
  summary["teachers"] = insertedTeachers.length;

  // ── Students ─────────────────────────────────────────────────────────────────
  const studentRows = loadCsv("students.csv");
  const studentUserDocs = studentRows.map((r) => ({
    email: `${r.studentId.toLowerCase()}@students.edushield.org`,
    passwordHash: DEMO_PASSWORD_HASH,
    role: "student" as const,
    schoolId,
    isActive: r.isActive === "True",
  }));
  const insertedStudentUsers = await User.insertMany(studentUserDocs, {
    ordered: false,
  });
  insertedStudentUsers.forEach((doc, i) => {
    idMap.user.set(studentRows[i].studentId, doc._id as mongoose.Types.ObjectId);
  });

  const studentProfileDocs = studentRows.map((r, i) => ({
    userId: insertedStudentUsers[i]._id,
    schoolId,
    studentCode: r.studentCode,
    firstName: r.firstName,
    lastName: r.lastName,
    dateOfBirth: new Date(r.dateOfBirth),
    gender: r.gender as "male" | "female" | "other" | "prefer_not_to_say",
    grade: r.grade,
    section: r.section,
    classId: idMap.class.get(r.classId),
    enrollmentDate: new Date("2025-06-01"),
    isActive: r.isActive === "True",
    emergencyContact: {
      name: r.emergencyContactName,
      phone: r.emergencyContactPhone,
      relationship: "guardian",
    },
  }));
  const insertedStudents = await Student.insertMany(studentProfileDocs, {
    ordered: true,
  });
  insertedStudents.forEach((doc, i) => {
    idMap.student.set(studentRows[i].studentId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Students: ${insertedStudents.length} profiles + ${insertedStudentUsers.length} users inserted`);
  summary["students"] = insertedStudents.length;

  // ── Parents (synthetic — one per student) ────────────────────────────────────
  log.info("  Generating parent profiles (1 per student)...");
  const parentUserDocs: object[] = [];
  const parentRelDocs: object[] = [];
  const parentProfileDocs: object[] = [];

  studentRows.forEach((r, i) => {
    const parentEmail = `parent.${r.studentId.toLowerCase()}@edushield.org`;
    const nameParts = r.emergencyContactName.split(" ");
    const firstName = nameParts[0] || "Parent";
    const lastName = nameParts.slice(1).join(" ") || r.lastName;
    parentUserDocs.push({
      email: parentEmail,
      passwordHash: DEMO_PASSWORD_HASH,
      role: "parent",
      schoolId,
      isActive: true,
    });
    parentProfileDocs.push({ _studentIdx: i, firstName, lastName });
    parentRelDocs.push({ _studentIdx: i });
  });

  const insertedParentUsers = await User.insertMany(parentUserDocs, {
    ordered: false,
  });

  // Now build actual parent profile docs with real userId
  const realParentProfileDocs = (
    parentProfileDocs as Array<{
      _studentIdx: number;
      firstName: string;
      lastName: string;
    }>
  ).map((p, i) => ({
    userId: insertedParentUsers[i]._id,
    schoolId,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: studentRows[p._studentIdx].emergencyContactPhone,
    preferredLanguage: "en",
  }));
  const insertedParents = await Parent.insertMany(realParentProfileDocs, {
    ordered: true,
  });
  insertedParents.forEach((doc, i) => {
    idMap.parent.set(studentRows[i].studentId, doc._id as mongoose.Types.ObjectId);
  });

  // ParentStudentRelationships
  const realParentRelDocs = insertedParents.map((parentDoc, i) => ({
    parentId: parentDoc._id,
    studentId: insertedStudents[i]._id,
    schoolId,
    relationship: "guardian" as const,
    isPrimary: true,
    canReceiveAlerts: true,
    canReceiveReports: true,
  }));
  await ParentStudentRelationship.insertMany(realParentRelDocs, {
    ordered: false,
  });
  log.ok(`  Parents: ${insertedParents.length} profiles + relationships inserted`);
  summary["parents"] = insertedParents.length;
  summary["parent_student_relationships"] = realParentRelDocs.length;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 4: TeacherClassAssignments & Enrollments
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 4: Assignments (class) & Enrollments");

  // TeacherClassAssignments — derive from teachers x classes x subjects
  // One teacher teaches one subject across all class sections in their grade
  const tcaDocs: object[] = [];
  teacherRows.forEach((tr) => {
    const teacherOid = idMap.teacher.get(tr.teacherId);
    if (!teacherOid) return;
    // Find the subject matching this teacher's specialization
    const subjectEntry = subjectRows.find(
      (s) => s.name === tr.subjectSpecialization
    );
    if (!subjectEntry) return;
    const subjectOid = idMap.subject.get(subjectEntry.subjectId);
    if (!subjectOid) return;
    // Assign to all classes
    classRows.forEach((cr) => {
      const classOid = idMap.class.get(cr.classId);
      if (!classOid) return;
      tcaDocs.push({
        teacherId: teacherOid,
        classId: classOid,
        subjectId: subjectOid,
        academicYear: "2025-26",
        isActive: true,
        schoolId,
      });
    });
  });
  await TeacherClassAssignment.insertMany(tcaDocs, { ordered: false });
  log.ok(`  TeacherClassAssignments: ${tcaDocs.length} inserted`);
  summary["teacher_class_assignments"] = tcaDocs.length;

  // Enrollments — one per student (in their class)
  const enrollmentDocs = studentRows.map((r, i) => ({
    studentId: insertedStudents[i]._id,
    classId: idMap.class.get(r.classId),
    academicYear: "2025-26",
    enrollmentDate: new Date("2025-06-01"),
    isActive: true,
    schoolId,
  }));
  await batchInsert(
    Enrollment,
    enrollmentDocs,
    "Enrollments"
  );
  summary["enrollments"] = enrollmentDocs.length;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 5: Assignments & Exams (depend on class/subject/teacher)
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 5: Assignments & Exams");

  const adminOid = idMap.user.get("admin@edushield.org")!;

  // Assignments
  const assignmentRows = loadCsv("assignments.csv");
  const assignmentDocs = assignmentRows.map((r) => {
    const classOid = idMap.class.get(r.classId);
    const subjectOid = idMap.subject.get(r.subjectId);
    const teacherOid = idMap.teacher.get(r.teacherId);
    return {
      schoolId,
      classId: classOid,
      subjectId: subjectOid,
      teacherId: teacherOid ?? adminOid,
      title: r.title,
      dueDate: new Date(r.dueDate),
      maxMarks: parseFloat(r.maxMarks) || 20,
      type: "homework" as const,
      isActive: true,
    };
  });
  const insertedAssignments = await Assignment.insertMany(assignmentDocs, {
    ordered: true,
  });
  insertedAssignments.forEach((doc, i) => {
    idMap.assignment.set(
      assignmentRows[i].assignmentId,
      doc._id as mongoose.Types.ObjectId
    );
  });
  log.ok(`  Assignments: ${insertedAssignments.length} inserted`);
  summary["assignments"] = insertedAssignments.length;

  // Exams
  const examRows = loadCsv("exams.csv");
  const examDocs = examRows.map((r) => ({
    schoolId,
    classId: idMap.class.get(r.classId),
    subjectId: idMap.subject.get(r.subjectId),
    name: r.name,
    type: r.type as
      | "unit_test"
      | "mid_term"
      | "final"
      | "assignment"
      | "quiz"
      | "practical",
    maxMarks: parseFloat(r.maxMarks),
    passingMarks: parseFloat(r.passingMarks),
    examDate: new Date(r.examDate),
    academicYear: r.academicYear,
    createdBy: adminOid,
    isPublished: true,
  }));
  const insertedExams = await Exam.insertMany(examDocs, { ordered: true });
  insertedExams.forEach((doc, i) => {
    idMap.exam.set(examRows[i].examId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Exams: ${insertedExams.length} inserted`);
  summary["exams"] = insertedExams.length;

  // ── Bus ───────────────────────────────────────────────────────────────────────
  const busRows = loadCsv("buses.csv");
  const busDocs = busRows.map((r) => ({
    schoolId,
    registrationNumber: r.registrationNumber,
    capacity: parseInt(r.capacity),
    deviceId: r.deviceId || undefined,
    routeCode: r.routeCode || undefined,
    isActive: true,
  }));
  const insertedBuses = await Bus.insertMany(busDocs, { ordered: true });
  insertedBuses.forEach((doc, i) => {
    idMap.bus.set(busRows[i].busId, doc._id as mongoose.Types.ObjectId);
  });
  log.ok(`  Buses: ${insertedBuses.length} inserted`);
  summary["buses"] = insertedBuses.length;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 6: Large tables — Attendance, HomeworkSubmissions, ExamResults
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 6: Large tables (Attendance / Submissions / Results)");

  // AttendanceRecord — 108k rows (REGENERATED WITH RECENT DATES)
  log.info("  Generating recent attendance records (last 30 days)...");

  // Generate attendance for last 30 days instead of using CSV
  const attendanceDocs = [];
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // Create risk profiles for students
  // 70% healthy, 20% moderate risk, 10% high risk
  const studentList = Array.from(idMap.student.values());
  const classIds = Array.from(idMap.class.values());
  const healthyCount = Math.floor(studentList.length * 0.70);
  const moderateCount = Math.floor(studentList.length * 0.20);

  const healthyStudents = studentList.slice(0, healthyCount);
  const moderateStudents = studentList.slice(healthyCount, healthyCount + moderateCount);
  const strugglingStudents = studentList.slice(healthyCount + moderateCount);

  // Store struggling students for behavior observations later
  const strugglingStudentIds = new Set(strugglingStudents);

  // Generate 180 records per student (6 days/week * 30 days)
  let studentIndex = 0;
  for (const studentId of studentList) {
    const isHealthy = healthyStudents.includes(studentId);
    const isModerate = moderateStudents.includes(studentId);

    // Determine attendance rate based on risk profile
    let baseAttendanceRate;
    if (isHealthy) {
      baseAttendanceRate = 0.92 + Math.random() * 0.08; // 92-100%
    } else if (isModerate) {
      baseAttendanceRate = 0.80 + Math.random() * 0.11; // 80-91%
    } else {
      baseAttendanceRate = 0.60 + Math.random() * 0.19; // 60-79%
    }

    // Get student's class (use round-robin if needed)
    const classId = studentIndex < studentRows.length
      ? idMap.class.get(studentRows[studentIndex].classId)
      : classIds[studentIndex % classIds.length];

    // Generate attendance records for school days in last 30 days
    for (let day = 0; day < 30; day++) {
      const currentDate = new Date(thirtyDaysAgo);
      currentDate.setDate(currentDate.getDate() + day);

      // Skip Sundays
      if (currentDate.getDay() === 0) continue;

      // Determine status based on attendance rate
      const rand = Math.random();
      let status: "present" | "absent" | "late" | "excused";

      if (rand < baseAttendanceRate) {
        status = "present";
      } else if (rand < baseAttendanceRate + 0.05) {
        status = "late";
      } else if (rand < baseAttendanceRate + 0.08) {
        status = "excused";
      } else {
        status = "absent";
      }

      attendanceDocs.push({
        studentId,
        classId: classId || classIds[0],
        date: new Date(currentDate),
        status,
        recordedBy: adminOid,
        schoolId,
      });
    }

    studentIndex++;
  }

  summary["attendance_records"] = await batchInsert(
    AttendanceRecord,
    attendanceDocs,
    "AttendanceRecords"
  );

  // HomeworkSubmission — 45k rows
  log.info("  Loading homework_submissions.csv...");
  const submissionRows = loadCsv("homework_submissions.csv");
  const submissionDocs = submissionRows.map((r) => ({
    assignmentId: idMap.assignment.get(r.assignmentId),
    studentId: idMap.student.get(r.studentId),
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : undefined,
    status: r.status as "submitted" | "late" | "graded" | "missing",
    marksAwarded: r.marksAwarded ? parseFloat(r.marksAwarded) : undefined,
    schoolId,
  }));
  summary["homework_submissions"] = await batchInsert(
    HomeworkSubmission,
    submissionDocs,
    "HomeworkSubmissions"
  );

  // ExamResult — 15k rows
  log.info("  Loading exam_results.csv...");
  const examResultRows = loadCsv("exam_results.csv");
  const examResultDocs = examResultRows.map((r) => ({
    studentId: idMap.student.get(r.studentId),
    examId: idMap.exam.get(r.examId),
    subjectId: r.subjectId ? idMap.subject.get(r.subjectId) : undefined,
    marksObtained: parseFloat(r.marksObtained),
    grade: r.grade || undefined,
    isPassed: r.isPassed === "True",
    enteredBy: adminOid,
    schoolId,
  }));
  summary["exam_results"] = await batchInsert(
    ExamResult,
    examResultDocs,
    "ExamResults"
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 7: Mood Check-ins — REGENERATED WITH RECENT DATES
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 7: Mood Check-ins");

  // Generate mood check-ins for last 30 days with realistic variation
  const checkinDocs = [];
  const moodLabels: Array<"great" | "good" | "okay" | "low" | "struggling"> = ["great", "good", "okay", "low", "struggling"];

  // Generate 120 check-ins per student over 30 days (4 per day average)
  for (const studentId of studentList) {
    const isHealthy = healthyStudents.includes(studentId);
    const isModerate = moderateStudents.includes(studentId);

    // Determine base mood based on risk profile
    let baseMood;
    if (isHealthy) {
      baseMood = 4.2 + Math.random() * 0.8; // 4.2-5.0 (good to great)
    } else if (isModerate) {
      baseMood = 3.0 + Math.random() * 1.2; // 3.0-4.2 (okay to good)
    } else {
      baseMood = 2.0 + Math.random() * 1.0; // 2.0-3.0 (low to okay)
    }

    // Generate 120 mood check-ins over 30 days
    for (let i = 0; i < 120; i++) {
      const daysBack = Math.floor(Math.random() * 30);
      const checkInDate = new Date(today);
      checkInDate.setDate(checkInDate.getDate() - daysBack);
      checkInDate.setHours(Math.floor(Math.random() * 8) + 8); // 8am-4pm

      // Add some day-to-day variation (±0.5 points)
      const moodScore = Math.max(1, Math.min(5, Math.round(baseMood + (Math.random() - 0.5))));
      const moodLabel = moodLabels[5 - moodScore]; // Map 5->great, 1->struggling

      checkinDocs.push({
        studentId,
        date: checkInDate,
        moodScore,
        moodLabel,
        notes: undefined,
        isAnonymous: false,
        nlpAnalyzed: false,
        schoolId,
        createdAt: checkInDate,
      });
    }
  }

  summary["mood_checkins"] = await batchInsert(
    MoodCheckin,
    checkinDocs,
    "MoodCheckins"
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 8: Safety Reports & Incidents
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 8: Safety Reports & Incidents");

  // SafetyReports
  const reportRows = loadCsv("safety_reports.csv");
  const reportDocs = reportRows.map((r) => {
    const isAnon = r.isAnonymous === "True";
    return {
      schoolId,
      reporterStudentId: isAnon
        ? undefined
        : idMap.student.get(r.reporterStudentId),
      isAnonymous: isAnon,
      reportType: r.reportType as
        | "bullying"
        | "physical_threat"
        | "unsafe_area"
        | "self_harm_concern"
        | "other",
      description: r.description,
      locationDescription: r.locationDescription || undefined,
      status: r.status as "new" | "under_review" | "resolved" | "closed",
      nlpAnalyzed: false,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    };
  });
  await batchInsert(
    SafetyReport,
    reportDocs,
    "SafetyReports"
  );
  summary["safety_reports"] = reportDocs.length;

  // SafetyIncidents
  const incidentRows = loadCsv("safety_incidents.csv");
  const incidentDocs = incidentRows.map((r) => ({
    schoolId,
    title: `${r.incidentType.replace(/_/g, " ")} at ${r.locationDescription}`,
    incidentType: r.incidentType as
      | "bullying"
      | "physical_altercation"
      | "theft"
      | "vandalism"
      | "threat"
      | "medical"
      | "other",
    description: `${r.incidentType} incident at ${r.locationDescription}`,
    location: {
      description: r.locationDescription,
      coordinates: {
        type: "Point" as const,
        coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)],
      },
    },
    incidentDate: new Date(r.incidentDate),
    reportedBy: adminOid,
    status: "open" as const,
  }));
  await batchInsert(
    SafetyIncident,
    incidentDocs,
    "SafetyIncidents"
  );
  summary["safety_incidents"] = incidentDocs.length;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 9: Behavior Observations (NEW - for high-risk students)
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 9: Behavior Observations");

  const { default: BehaviorObservation } = await import("../src/models/BehaviorObservation");

  const behaviorDocs = [];
  const behaviorCategories: Array<"participation" | "conduct" | "peer_interaction" | "focus" | "other"> =
    ["participation", "conduct", "peer_interaction", "focus", "other"];

  const concernNotes = [
    "Disruptive behavior during class, repeatedly talking out of turn",
    "Not participating in group activities, isolating from peers",
    "Difficulty focusing on tasks, frequently distracted",
    "Incomplete assignments, not following instructions",
    "Argumentative with classmates, conflict during group work",
    "Late to class multiple times this week",
    "Not bringing required materials to class",
    "Sleeping during lecture, appears exhausted",
    "Aggressive response when corrected by teacher",
    "Failure to complete homework consistently"
  ];

  // Add behavior observations for struggling students only
  // Generate 3-8 concerns per struggling student over last 30 days
  const teacherList = Array.from(idMap.teacher.values());

  for (const studentId of Array.from(strugglingStudentIds)) {
    const concernCount = 3 + Math.floor(Math.random() * 6); // 3-8 concerns

    // Get a random teacher for this student
    const teacherId = teacherList[Math.floor(Math.random() * teacherList.length)];

    for (let i = 0; i < concernCount; i++) {
      const daysBack = Math.floor(Math.random() * 30);
      const observationDate = new Date(today);
      observationDate.setDate(observationDate.getDate() - daysBack);
      observationDate.setHours(Math.floor(Math.random() * 8) + 8); // 8am-4pm

      behaviorDocs.push({
        schoolId,
        studentId,
        teacherId,
        observationDate,
        type: "concern",
        category: behaviorCategories[Math.floor(Math.random() * behaviorCategories.length)],
        notes: concernNotes[Math.floor(Math.random() * concernNotes.length)],
        actionTaken: i % 2 === 0 ? "Spoke with student after class" : undefined,
      });
    }
  }

  summary["behavior_observations"] = await batchInsert(
    BehaviorObservation,
    behaviorDocs,
    "BehaviorObservations"
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RISK SCORES
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Generating Risk Scores");

  try {
    // Import RiskScoreService
    const { RiskScoreService } = await import("../src/services/risk-score.service");

    // Generate risk scores for all students
    const riskResults = await RiskScoreService.generateRiskScoresForSchool(schoolId);

    summary["risk_scores"] = riskResults.success;

    log.ok(`  Risk Scores: ${riskResults.success} generated`);
    log.info(`    Low risk: ${riskResults.low}`);
    log.info(`    Medium risk: ${riskResults.medium}`);
    log.info(`    High risk: ${riskResults.high}`);
    log.info(`    Requiring counselor review: ${riskResults.high}`);

    if (riskResults.failed > 0) {
      log.warn(`    Failed: ${riskResults.failed}`);
    }
  } catch (error) {
    log.err(`Risk score generation failed: ${error instanceof Error ? error.message : String(error)}`);
    summary["risk_scores"] = 0;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Seed Complete — Summary");

  const totalDocs = Object.values(summary).reduce((a, b) => a + b, 0);
  const maxLabelLen = Math.max(...Object.keys(summary).map((k) => k.length));

  console.log();
  Object.entries(summary).forEach(([collection, count]) => {
    const pad = " ".repeat(maxLabelLen - collection.length + 2);
    console.log(
      `  ${c.cyan}${collection}${c.reset}${pad}${c.bold}${count.toLocaleString()}${c.reset}`
    );
  });
  console.log(
    `\n  ${c.bold}${c.green}TOTAL: ${totalDocs.toLocaleString()} documents${c.reset}\n`
  );

  await mongoose.disconnect();
  log.ok("Disconnected. Seed complete.");
  process.exit(0);
}

main().catch((err: Error) => {
  log.err(`Seed failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
