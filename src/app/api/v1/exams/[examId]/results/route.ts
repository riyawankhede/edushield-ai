import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Exam, ExamResult, Student } from "@/models";
import { TeacherService } from "@/services/teacher.service";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError, APIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ examId: string }> }
) {
  try {
    await connectDB();
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "50", 10));

    const skip = (page - 1) * pageSize;
    const filter = { examId: params.examId };

    const [results, total] = await Promise.all([
      ExamResult.find(filter)
        .sort({ studentId: 1 })
        .skip(skip)
        .limit(pageSize)
        .populate({ path: "studentId", select: "firstName lastName studentCode" })
        .lean(),
      ExamResult.countDocuments(filter),
    ]);

    return apiSuccess(results, {
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
 * POST /api/v1/exams/:examId/results
 * WRITE OPERATION: Teacher enters exam marks
 * SECURITY: Authenticated teacher only (JWT). WRITE-GUARD: teacher must be
 * assigned to the exam's class AND subject. Exam and student must belong to
 * the authenticated school.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ examId: string }> }
) {
  try {
    await connectDB();
    const params = await props.params;

    // 1. AUTHENTICATION: Teacher identity MUST come from the verified JWT.
    // Client-supplied teacherId / x-user-id / x-user-role are NEVER trusted.
    const auth = await requireAuth(request, "teacher");

    const body = await request.json();

    const { studentId, marksObtained, remarks } = body;

    if (!studentId || marksObtained === undefined) {
      throw APIError.validationError("Missing required fields: studentId and marksObtained are required.");
    }

    // 2. AUTHENTICATED TEACHER: Resolve the teacher profile via JWT userId + schoolId.
    // Does NOT use the "me"/first-teacher fallback. body.teacherId cannot override.
    const teacher = await TeacherService.resolveTeacherByUserId(auth.userId, auth.schoolId);
    if (!teacher) {
      throw APIError.notFound("Authenticated teacher profile not found.");
    }

    // 3. School-scoped exam lookup: the exam MUST belong to the authenticated
    // teacher's school. Cross-school exam access returns NOT_FOUND.
    const exam = await Exam.findOne({
      _id: params.examId,
      schoolId: auth.schoolId,
    }).lean();
    if (!exam) {
      throw APIError.notFound(`Exam '${params.examId}' not found.`);
    }

    // 4. CRITICAL WRITE-GUARD: Verify teacher is assigned to this exam's class AND subject!
    // Throws 403 FORBIDDEN if teacher is not assigned to this class and subject.
    await TeacherService.verifyAssignment(
      teacher,
      exam.classId.toString(),
      exam.subjectId.toString()
    );

    // 5. STUDENT MEMBERSHIP: The student must belong to the authenticated
    // school AND to the exam's class. Prevents cross-school/cross-class
    // data pollution (e.g. School A teacher + School B student).
    const student = await Student.findOne({
      _id: studentId,
      schoolId: auth.schoolId,
      classId: exam.classId,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!student) {
      throw APIError.notFound("Student not found in this class.");
    }

    // 6. Determine pass/fail & grade
    const isPassed = marksObtained >= exam.passingMarks;
    const grade =
      marksObtained >= 22 ? "A" :
      marksObtained >= 18 ? "B" :
      marksObtained >= 14 ? "C" :
      marksObtained >= 10 ? "D" : "F";

    const result = await ExamResult.findOneAndUpdate(
      {
        examId: exam._id,
        studentId,
      },
      {
        examId: exam._id,
        studentId,
        subjectId: exam.subjectId,
        marksObtained,
        grade,
        isPassed,
        remarks: remarks || "",
        enteredBy: auth.userId,
        schoolId: auth.schoolId,
      },
      { upsert: true, new: true }
    );

    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
