import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AttendanceRecord } from "@/models";
import { TeacherService } from "@/services/teacher.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const date = searchParams.get("date");

    const filter: Record<string, unknown> = {};
    if (classId) filter.classId = classId;
    if (studentId) filter.studentId = studentId;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);
      filter.date = { $gte: d, $lt: nextD };
    }

    const skip = (page - 1) * pageSize;
    const [records, total] = await Promise.all([
      AttendanceRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      AttendanceRecord.countDocuments(filter),
    ]);

    return apiSuccess(records, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * POST /api/v1/attendance
 * WRITE OPERATION: Teacher marks attendance
 * WRITE-GUARD: Explicitly verifies teacher is assigned to this class before writing!
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { teacherId, classId, studentId, date, status, remarks } = body;

    if (!classId || !studentId || !status) {
      throw APIError.validationError("Missing required fields: classId, studentId, and status are required.");
    }

    // 1. Resolve teacher (uses teacherId from body, or "me" for demo)
    const teacher = await TeacherService.resolveTeacher(teacherId || "me");

    // 2. CRITICAL WRITE-GUARD: Verify teacher is assigned to this class!
    // Throws 403 FORBIDDEN if teacher is not assigned to this class.
    await TeacherService.verifyAssignment(teacher, classId);

    // 3. Upsert attendance record for this student and date
    const recordDate = date ? new Date(date) : new Date();
    recordDate.setHours(0, 0, 0, 0);

    const record = await AttendanceRecord.findOneAndUpdate(
      {
        studentId,
        classId,
        date: recordDate,
        schoolId: teacher.schoolId,
      },
      {
        studentId,
        classId,
        date: recordDate,
        status,
        remarks: remarks || "",
        recordedBy: teacher.userId || teacher._id,
        schoolId: teacher.schoolId,
      },
      { upsert: true, new: true }
    );

    return apiSuccess(record, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
