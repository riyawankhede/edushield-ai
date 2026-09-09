import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AttendanceRecord, Student } from "@/models";
import { TeacherService } from "@/services/teacher.service";
import { AttendanceService } from "@/services/attendance.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(
      request,
      "student",
      "parent",
      "teacher",
      "counselor",
      "admin"
    );

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const classId = searchParams.get("classId") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const date = searchParams.get("date") || undefined;
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const status = searchParams.get("status") || undefined;

    const result = await AttendanceService.getAuthorizedAttendance(auth, {
      page,
      pageSize,
      classId,
      studentId,
      date,
      fromDate,
      toDate,
      status,
    });

    return apiSuccess(result.records, result.meta);
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * POST /api/v1/attendance
 * WRITE OPERATION: Teacher marks attendance
 * SECURITY: Authenticated teacher only (JWT). WRITE-GUARD: teacher must be
 * assigned to this class before writing. Student must belong to the
 * authenticated school AND the requested class.
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // 1. AUTHENTICATION: Teacher identity MUST come from the verified JWT.
    // Client-supplied teacherId / x-user-id / x-user-role are NEVER trusted.
    const auth = await requireAuth(request, "teacher");

    const body = await request.json();

    const { classId, studentId, date, status, remarks } = body;

    if (!classId || !studentId || !status) {
      throw APIError.validationError("Missing required fields: classId, studentId, and status are required.");
    }

    // 2. AUTHENTICATED TEACHER: Resolve the teacher profile via JWT userId + schoolId.
    // Does NOT use the "me"/first-teacher fallback. body.teacherId cannot override.
    const teacher = await TeacherService.resolveTeacherByUserId(auth.userId, auth.schoolId);
    if (!teacher) {
      throw APIError.notFound("Authenticated teacher profile not found.");
    }

    // 3. CRITICAL WRITE-GUARD: Verify teacher is assigned to this class!
    // Throws 403 FORBIDDEN if teacher is not assigned to this class.
    await TeacherService.verifyAssignment(teacher, classId);

    // 4. STUDENT MEMBERSHIP: The student must belong to the authenticated
    // school AND to the requested class. Prevents cross-school/cross-class
    // data pollution (e.g. School A teacher + School B student).
    const student = await Student.findOne({
      _id: studentId,
      schoolId: auth.schoolId,
      classId,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!student) {
      throw APIError.notFound("Student not found in this class.");
    }

    // 5. Upsert attendance record for this student and date
    const recordDate = date ? new Date(date) : new Date();
    recordDate.setHours(0, 0, 0, 0);

    const record = await AttendanceRecord.findOneAndUpdate(
      {
        studentId,
        classId,
        date: recordDate,
        schoolId: auth.schoolId,
      },
      {
        studentId,
        classId,
        date: recordDate,
        status,
        remarks: remarks || "",
        recordedBy: auth.userId,
        schoolId: auth.schoolId,
      },
      { upsert: true, new: true }
    );

    return apiSuccess(record, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
