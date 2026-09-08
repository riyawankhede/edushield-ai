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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchInsert(
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
  log.info("Connecting to MongoDB Atlas...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  log.ok(`Connected to DB: ${mongoose.connection.db?.databaseName}`);

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
  } = await import("../src/models/index");

  // ── ID maps: CSV natural key → MongoDB ObjectId ─────────────────────────────
  const idMap = {
    school: new Map<string, mongoose.Types.ObjectId>(),
    class: new Map<string, mongoose.Types.ObjectId>(),
    subject: new Map<string, mongoose.Types.ObjectId>(),
    student: new Map<string, mongoose.Types.ObjectId>(),
    teacher: new Map<string, mongoose.Types.ObjectId>(),
    parent: new Map<string, mongoose.Types.ObjectId>(),
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
    passwordHash: "$2b$10$placeholder_hash_admin_do_not_use",
    role: "admin",
    schoolId,
    isActive: true,
  });
  idMap.user.set("admin@edushield.org", adminUserDoc._id as mongoose.Types.ObjectId);
  log.ok(`  Admin user: 1 inserted`);

  // ── Teachers ─────────────────────────────────────────────────────────────────
  const teacherRows = loadCsv("teachers.csv");
  const teacherUserDocs = teacherRows.map((r) => ({
    email: r.email,
    passwordHash: "$2b$10$placeholder_hash_seed_do_not_use",
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
    passwordHash: "$2b$10$placeholder_hash_seed_do_not_use",
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
      passwordHash: "$2b$10$placeholder_hash_seed_do_not_use",
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

  // AttendanceRecord — 108k rows
  log.info("  Loading attendance_records.csv...");
  const attendanceRows = loadCsv("attendance_records.csv");
  const attendanceDocs = attendanceRows.map((r) => ({
    studentId: idMap.student.get(r.studentId),
    classId: idMap.class.get(r.classId),
    date: new Date(r.date),
    status: r.status as "present" | "absent" | "late" | "excused",
    recordedBy: adminOid,
    schoolId,
  }));
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
  // LAYER 7: Mood Check-ins — 72k rows
  // ════════════════════════════════════════════════════════════════════════════
  log.section("Layer 7: Mood Check-ins");

  const checkinRows = loadCsv("mood_checkins.csv");
  const checkinDocs = checkinRows.map((r) => ({
    studentId: idMap.student.get(r.studentId),
    date: new Date(r.date),
    moodScore: parseInt(r.moodScore),
    moodLabel: r.moodLabel as "great" | "good" | "okay" | "low" | "struggling",
    notes: r.notes || undefined,
    isAnonymous: r.isAnonymous === "True",
    nlpAnalyzed: false,
    schoolId,
    createdAt: new Date(r.date),
  }));
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
