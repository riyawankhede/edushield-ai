import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Exam, ExamResult } from "@/models";
import { TeacherService } from "@/services/teacher.service";
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
 * WRITE-GUARD: Explicitly verifies teacher is assigned to this exam's class AND subject before writing!
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ examId: string }> }
) {
  try {
    await connectDB();
    const params = await props.params;
    const body = await request.json();

    const { teacherId, studentId, marksObtained, remarks } = body;

    if (!studentId || marksObtained === undefined) {
      throw APIError.validationError("Missing required fields: studentId and marksObtained are required.");
    }

    // 1. Fetch the exam to determine its assigned class and subject
    const exam = await Exam.findById(params.examId).lean();
    if (!exam) {
      throw APIError.notFound(`Exam '${params.examId}' not found.`);
    }

    // 2. Resolve teacher
    const teacher = await TeacherService.resolveTeacher(teacherId || "me");

    // 3. CRITICAL WRITE-GUARD: Verify teacher is assigned to this exam's class AND subject!
    // Throws 403 FORBIDDEN if teacher is not assigned to this class and subject.
    await TeacherService.verifyAssignment(
      teacher,
      exam.classId.toString(),
      exam.subjectId.toString()
    );

    // 4. Determine pass/fail & grade
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
        enteredBy: teacher.userId || teacher._id,
        schoolId: exam.schoolId,
      },
      { upsert: true, new: true }
    );

    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return handleAPIError(error);
  }
}
