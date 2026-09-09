import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  AttendanceRecord,
  Student,
  Parent,
  ParentStudentRelationship,
  Teacher,
  TeacherClassAssignment,
  Admin,
  Counselor,
  Class,
} from "@/models";
import type { AuthContext } from "@/lib/auth";
import mongoose from "mongoose";

export interface AttendanceQueryOptions {
  page?: number;
  pageSize?: number;
  classId?: string;
  studentId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
}

export class AttendanceService {
  /**
   * AUTHORIZED READ: Attendance records scoped to verified JWT identity and school.
   *
   * Rules:
   * - student   : own attendance records only (resolved via { userId: auth.userId, schoolId: auth.schoolId, isActive: true })
   * - parent    : linked children's attendance records only (via ParentStudentRelationship in auth.schoolId)
   * - teacher   : assigned classes only (via TeacherClassAssignment in auth.schoolId); requested classId/studentId must be in assigned scope
   * - counselor : class attendance in auth.schoolId (read-only); requested classId/studentId must belong to auth.schoolId
   * - admin     : attendance in auth.schoolId; requested classId/studentId must belong to auth.schoolId
   * - other     : fail closed with 403 Forbidden
   */
  static async getAuthorizedAttendance(
    auth: AuthContext,
    options: AttendanceQueryOptions
  ) {
    await connectDB();

    const FORBIDDEN =
      "Access denied. You are not authorized to view these attendance records.";

    const filter: Record<string, unknown> = {
      schoolId: auth.schoolId,
    };

    switch (auth.role) {
      case "student": {
        const student = await Student.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id classId schoolId")
          .lean();

        if (!student) throw APIError.forbidden(FORBIDDEN);

        if (
          options.studentId &&
          options.studentId !== "me" &&
          options.studentId !== student._id.toString()
        ) {
          throw APIError.forbidden(FORBIDDEN);
        }

        filter.studentId = student._id;

        if (options.classId) {
          if (student.classId && options.classId !== student.classId.toString()) {
            return {
              records: [],
              meta: {
                page: 1,
                pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 20)),
                total: 0,
                totalPages: 0,
              },
            };
          }
          filter.classId = options.classId;
        }
        break;
      }

      case "parent": {
        const parent = await Parent.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
        })
          .select("_id schoolId")
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
            records: [],
            meta: {
              page: 1,
              pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 20)),
              total: 0,
              totalPages: 0,
            },
          };
        }

        if (options.studentId) {
          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (!isObjectId || !linkedStudentIds.includes(options.studentId)) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = options.studentId;
        } else {
          filter.studentId = {
            $in: linkedStudentIds,
          };
        }

        if (options.classId) {
          const targetIds = options.studentId
            ? [options.studentId]
            : linkedStudentIds;

          const matchingChild = await Student.findOne({
            _id: { $in: targetIds },
            classId: options.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!matchingChild) {
            return {
              records: [],
              meta: {
                page: 1,
                pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 20)),
                total: 0,
                totalPages: 0,
              },
            };
          }
          filter.classId = options.classId;
        }
        break;
      }

      case "teacher": {
        const teacher = await Teacher.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        }).lean();

        if (!teacher) throw APIError.forbidden(FORBIDDEN);

        const assignments = await TeacherClassAssignment.find({
          teacherId: teacher._id,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("classId")
          .lean();

        const assignedClassIds = [
          ...new Set(assignments.map((a) => a.classId.toString())),
        ];

        if (assignedClassIds.length === 0) {
          return {
            records: [],
            meta: {
              page: 1,
              pageSize: Math.min(100, Math.max(1, Number(options.pageSize) || 20)),
              total: 0,
              totalPages: 0,
            },
          };
        }

        let targetClassIds = assignedClassIds;
        if (options.classId) {
          if (!assignedClassIds.includes(options.classId)) {
            throw APIError.forbidden(FORBIDDEN);
          }
          targetClassIds = [options.classId];
        }

        if (options.studentId) {
          if (options.studentId === "me") throw APIError.forbidden(FORBIDDEN);

          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.studentId) &&
            /^[0-9a-fA-F]{24}$/.test(options.studentId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const studentInClass = await Student.findOne({
            _id: options.studentId,
            classId: { $in: targetClassIds },
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id classId")
            .lean();

          if (!studentInClass) {
            throw APIError.forbidden(FORBIDDEN);
          }
          filter.studentId = studentInClass._id;
          filter.classId = studentInClass.classId;
        } else {
          filter.classId = {
            $in: targetClassIds,
          };
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
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!student) throw APIError.forbidden(FORBIDDEN);
          filter.studentId = student._id;
        }

        if (options.classId) {
          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.classId) &&
            /^[0-9a-fA-F]{24}$/.test(options.classId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const cls = await Class.findOne({
            _id: options.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!cls) throw APIError.forbidden(FORBIDDEN);
          filter.classId = cls._id;
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
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!student) throw APIError.forbidden(FORBIDDEN);
          filter.studentId = student._id;
        }

        if (options.classId) {
          const isObjectId =
            mongoose.Types.ObjectId.isValid(options.classId) &&
            /^[0-9a-fA-F]{24}$/.test(options.classId);
          if (!isObjectId) throw APIError.forbidden(FORBIDDEN);

          const cls = await Class.findOne({
            _id: options.classId,
            schoolId: auth.schoolId,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (!cls) throw APIError.forbidden(FORBIDDEN);
          filter.classId = cls._id;
        }
        break;
      }

      default:
        throw APIError.forbidden(FORBIDDEN);
    }

    // Apply date filters
    if (options.date) {
      const d = new Date(options.date);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);
        filter.date = { $gte: d, $lt: nextD };
      }
    } else if (options.fromDate || options.toDate) {
      const dateFilter: Record<string, Date> = {};
      if (options.fromDate) {
        const fd = new Date(options.fromDate);
        if (!isNaN(fd.getTime())) {
          fd.setHours(0, 0, 0, 0);
          dateFilter.$gte = fd;
        }
      }
      if (options.toDate) {
        const td = new Date(options.toDate);
        if (!isNaN(td.getTime())) {
          td.setHours(23, 59, 59, 999);
          dateFilter.$lte = td;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.date = dateFilter;
      }
    }

    // Apply status filter
    if (
      options.status &&
      ["present", "absent", "late", "excused"].includes(options.status)
    ) {
      filter.status = options.status;
    }

    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      AttendanceRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      AttendanceRecord.countDocuments(filter),
    ]);

    return {
      records,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
