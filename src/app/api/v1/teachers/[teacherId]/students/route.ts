import { NextRequest } from "next/server";
import { TeacherService } from "@/services/teacher.service";
import { Student } from "@/models";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ teacherId: string }> }
) {
  try {
    const params = await props.params;
    const teacher = await TeacherService.resolveTeacher(params.teacherId);

    // DATA ISOLATION: get only classes assigned to this teacher
    const { classIds, classes } = await TeacherService.getAssignedScope(teacher);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const filterClassId = searchParams.get("classId") || undefined;

    // Strict scoping: filter can only be one of the assigned classes
    let targetClassIds = classIds;
    if (filterClassId) {
      if (!classIds.includes(filterClassId)) {
        return apiSuccess([], {
          page: 1,
          pageSize,
          total: 0,
          totalPages: 0,
        });
      }
      targetClassIds = [filterClassId];
    }

    const classObjectIds = targetClassIds.map((id) => new mongoose.Types.ObjectId(id));
    const skip = (page - 1) * pageSize;

    const [students, total] = await Promise.all([
      Student.find({
        classId: { $in: classObjectIds },
        schoolId: teacher.schoolId,
        isActive: true,
      })
        .sort({ studentCode: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Student.countDocuments({
        classId: { $in: classObjectIds },
        schoolId: teacher.schoolId,
        isActive: true,
      }),
    ]);

    const classMap = new Map(classes.map((c) => [c._id.toString(), c.name]));

    const enriched = students.map((s) => ({
      ...s,
      className: classMap.get(s.classId?.toString() || "") || "–",
    }));

    return apiSuccess(enriched, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
