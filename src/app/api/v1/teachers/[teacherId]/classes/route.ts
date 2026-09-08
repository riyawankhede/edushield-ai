import { NextRequest } from "next/server";
import { TeacherService } from "@/services/teacher.service";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ teacherId: string }> }
) {
  try {
    const params = await props.params;
    const teacher = await TeacherService.resolveTeacher(params.teacherId);
    const { classes, subjects, assignments } = await TeacherService.getAssignedScope(teacher);

    return apiSuccess({
      teacherId: teacher._id.toString(),
      staffCode: teacher.staffCode,
      name: `${teacher.firstName} ${teacher.lastName}`,
      totalAssignedClasses: classes.length,
      classes: classes.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        grade: c.grade,
        section: c.section,
      })),
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        code: s.code,
      })),
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        classId: a.classId.toString(),
        subjectId: a.subjectId.toString(),
        academicYear: a.academicYear,
      })),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
