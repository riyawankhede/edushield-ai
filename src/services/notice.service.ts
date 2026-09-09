import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  Notice,
  Student,
  Teacher,
  Parent,
  Counselor,
  Admin,
} from "@/models";
import type { AuthContext } from "@/lib/auth";
import type { PaginationMeta } from "@/lib/api-response";

export interface NoticeQueryOptions {
  page?: number;
  pageSize?: number;
  priority?: string;
  targetRole?: string;
  schoolId?: string;
}

export interface AuthorizedNoticesResult {
  notices: unknown[];
  meta: PaginationMeta;
}

export class NoticeService {
  /**
   * AUTHORIZED READ: Notices scoped to verified JWT identity, school, and role.
   *
   * Security Rules:
   * 1. Caller must be authenticated with a permitted role (admin, teacher, counselor, parent, student).
   * 2. Active profile verification: caller must have an active profile in auth.schoolId.
   * 3. Tenant isolation: every Notice query is strictly scoped to auth.schoolId.
   *    If client passes options.schoolId !== auth.schoolId, request is rejected with 403 Forbidden.
   * 4. Audience scoping:
   *    - admin     : can view all published notices for their school (or filter by targetRole).
   *    - non-admin : can only view notices targeted to their role or school-wide announcements (empty targetRoles).
   * 5. Query gating: authorization and profile validation execute before any Notice database queries.
   */
  static async getAuthorizedNotices(
    auth: AuthContext,
    options: NoticeQueryOptions = {}
  ): Promise<AuthorizedNoticesResult> {
    await connectDB();

    const FORBIDDEN =
      "Access denied. You are not authorized to view notices for this school.";

    // 1. Role verification & Active profile lookup
    switch (auth.role) {
      case "student": {
        const student = await Student.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();
        if (!student) {
          throw APIError.forbidden(FORBIDDEN);
        }
        break;
      }
      case "parent": {
        const parent = await Parent.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();
        if (!parent) {
          throw APIError.forbidden(FORBIDDEN);
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
        if (!teacher) {
          throw APIError.forbidden(FORBIDDEN);
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
        if (!counselor) {
          throw APIError.forbidden(FORBIDDEN);
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
        if (!admin) {
          throw APIError.forbidden(FORBIDDEN);
        }
        break;
      }
      default: {
        throw APIError.forbidden(FORBIDDEN);
      }
    }

    // 2. Cross-school parameter check (prevent client-supplied override)
    if (options.schoolId && options.schoolId !== auth.schoolId) {
      throw APIError.forbidden("Access denied. Cross-school access is prohibited.");
    }

    // 3. Build tenant-isolated query
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {
      schoolId: auth.schoolId,
      isPublished: true,
    };

    if (options.priority && ["low", "normal", "high"].includes(options.priority)) {
      filter.priority = options.priority;
    }

    // 4. Role-based audience scoping
    if (auth.role === "admin") {
      if (options.targetRole) {
        filter.targetRoles = options.targetRole;
      }
    } else {
      filter.$or = [
        { targetRoles: { $exists: false } },
        { targetRoles: { $size: 0 } },
        { targetRoles: auth.role },
      ];
    }

    // 5. Query execution
    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Notice.countDocuments(filter),
    ]);

    return {
      notices,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
