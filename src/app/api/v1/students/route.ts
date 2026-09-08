import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Student } from "@/models";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));
    const grade = searchParams.get("grade") || undefined;
    const section = searchParams.get("section") || undefined;
    const search = searchParams.get("search") || undefined;

    const filter: Record<string, unknown> = { isActive: true };
    if (grade) filter.grade = grade;
    if (section) filter.section = section;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { studentCode: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [students, total] = await Promise.all([
      Student.find(filter)
        .sort({ studentCode: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Student.countDocuments(filter),
    ]);

    return apiSuccess(students, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
