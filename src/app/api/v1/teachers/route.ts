import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Teacher } from "@/models";
import { apiSuccess } from "@/lib/api-response";
import { handleAPIError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));

    const skip = (page - 1) * pageSize;
    const filter = { isActive: true };

    const [teachers, total] = await Promise.all([
      Teacher.find(filter)
        .sort({ staffCode: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Teacher.countDocuments(filter),
    ]);

    return apiSuccess(teachers, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
