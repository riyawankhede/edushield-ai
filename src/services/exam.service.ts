import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  Exam,
  ExamResult,
  Student,
  Parent,
  ParentStudentRelationship,
  Teacher,
  TeacherClassAssignment,
  Counselor,
  Admin,
} from "@/models";
import type { AuthContext } from "@/lib/auth";
import mongoose from "mongoose";

export interface ExamResultsQueryOptions {
  page?: number;
  pageSize?: number;
  studentId?: string;
  classId?: string;
}

export class ExamService {
  /**
   * AUTHORIZED READ: Exam results scoped to verified JWT identity, school, and role.
   *
   * Rules:
   * 1. Exam must exist and belong to auth.schoolId.
   * 2. If options.classId is provided, it must match exam.classId.
   * 3. Role-based scoping:
   *    - student   : own results only for this exam.
   *    - parent    : linked children's results only for this exam.
   *    - teacher   : assigned to exam's class in auth.schoolId only.
   *    - counselor : read-only access to exam results in auth.schoolId.
   *    - admin     : school-scoped access in auth.schoolId.
   *    - other     : fail closed with 403 Forbidden.
   * 4. Query gating: unauthorized requests throw before querying ExamResult.
   */
  static async getAuthorizedExamResults(
    auth: AuthContext,
    examId: string,
    options: ExamResultsQueryOptions
  ) {
    await connectDB();

    const FORBIDDEN =
      "Access denied. You are not authorized to view these exam results.";

    // Validate examId format
    if (
      !examId ||
      !mongoose.Types.ObjectId.isValid(examId) ||
      !/^[0-9a-fA-F]{24}$/.test(examId)
    ) {
      throw APIError.forbidden(FORBIDDEN);
    }

    // Resolve and authorize the exam within caller's school
    const exam = await Exam.findOne({
      _id: examId,
      schoolId: auth.schoolId,
    }).lean();

    if (!exam) {
      throw APIError.forbidden(FORBIDDEN);
    }

    // If a classId filter was passed, it must match the exam's class
    if (options.classId && options.classId !== exam.classId.toString()) {
      throw APIError.forbidden(FORBIDDEN);
    }

    const filter: Record<string, unknown> = {
      examId: exam._id,
      schoolId: auth.schoolId,
    };

    switch (auth.role) {
      case "student": {
        const student = await Student.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id classId")
          .lean();

        if (!student) throw APIError.forbidden(FORBIDDEN);

        // Student can only access their own results
        if (
          options.studentId &&
          options.studentId !== "me" &&
          options.studentId !== student._id.toString()
        ) {
          throw APIError.forbidden(FORBIDDEN);
        }

        // Student's class must match exam's class
        if (
          student.classId &&
          exam.classId &&
          student.classId.toString() !== exam.classId.toString()
        ) {
          return {
            results: [],
            meta: {
              page: 1,
              pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 50)),
              total: 0,
              totalPages: 0,
            },
          };
        }

        filter.studentId = student._id;
        break;
      }

      case "parent": {
        const parent = await Parent.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
        })
          .select("_id")
          .lean();

        if (!parent) throw APIError.forbidden(FORBIDDEN);

        const relationships = await ParentStudentRelationship.find({
          parentId: parent._id,
          schoolId: auth.schoolId,
        })
          .select("studentId")
          .lean();

        const linkedStudentIds = relationships.map((r) => r.studentId.toString());
        if (linkedStudentIds.length === 0) {
          return {
            results: [],
            meta: {
              page: 1,
              pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 50)),
              total: 0,
              totalPages: 0,
            },
          };
        }

        if (options.studentId) {
          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (
            options.studentId === "me" ||
            !isObjectId ||
            !linkedStudentIds.includes(options.studentId)
          ) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = options.studentId;
        } else {
          filter.studentId = {
            $in: linkedStudentIds,
          };
        }
        break;
      }

      case "teacher": {
        const teacher = await Teacher.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();

        if (!teacher) throw APIError.forbidden(FORBIDDEN);

        // Teacher must be assigned to the exam's class
        const assignment = await TeacherClassAssignment.findOne({
          teacherId: teacher._id,
          classId: exam.classId,
          schoolId: auth.schoolId,
          isActive: true,
        }).lean();

        if (!assignment) {
          throw APIError.forbidden(FORBIDDEN);
        }

        if (options.studentId) {
          if (options.studentId === "me") throw APIError.forbidden(FORBIDDEN);

          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const student = await Student.findOne({
            _id: options.studentId,
            classId: exam.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!student) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = student._id;
        }
        break;
      }

      case "counselor": {
        const counselor = await Counselor.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();

        if (!counselor) throw APIError.forbidden(FORBIDDEN);

        if (options.studentId) {
          if (options.studentId === "me") throw APIError.forbidden(FORBIDDEN);

          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const student = await Student.findOne({
            _id: options.studentId,
            classId: exam.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!student) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = student._id;
        }
        break;
      }

      case "admin": {
        const admin = await Admin.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();

        if (!admin) throw APIError.forbidden(FORBIDDEN);

        if (options.studentId) {
          if (options.studentId === "me") throw APIError.forbidden(FORBIDDEN);

          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const student = await Student.findOne({
            _id: options.studentId,
            classId: exam.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!student) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = student._id;
        }
        break;
      }

      default:
        throw APIError.forbidden(FORBIDDEN);
    }

    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 50));
    const skip = (page - 1) * pageSize;

    const [results, total] = await Promise.all([
      ExamResult.find(filter)
        .sort({ studentId: 1 })
        .skip(skip)
        .limit(pageSize)
        .populate({ path: "studentId", select: "firstName lastName studentCode" })
        .lean(),
      ExamResult.countDocuments(filter),
    ]);

    return {
      results,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
