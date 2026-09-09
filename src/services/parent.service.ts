import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  Parent,
  ParentStudentRelationship,
  Student,
  Exam,
  Subject,
  Bus,
  Admin,
} from "@/models";
import { StudentService } from "@/services/student.service";
import type { AuthContext } from "@/lib/auth";
import mongoose from "mongoose";

export class ParentService {
  /**
   * Helper: Resolve parent by ID or return first parent for "me" / "current" demo
   */
  static async resolveParent(parentId?: string) {
    await connectDB();

    if (!parentId || parentId === "me" || parentId === "current") {
      const parent = await Parent.findOne().lean();
      if (!parent) throw APIError.notFound("No parent profiles found in database.");
      return parent;
    }

    const isObjectId =
      mongoose.Types.ObjectId.isValid(parentId) && /^[0-9a-fA-F]{24}$/.test(parentId);

    const query = isObjectId
      ? { _id: parentId }
      : {
          $or: [
            { phone: parentId },
            { userId: isObjectId ? parentId : undefined },
          ].filter(Boolean),
        };

    const parent = await Parent.findOne(query).lean();
    if (!parent) {
      throw APIError.notFound(`Parent '${parentId}' not found.`);
    }
    return parent;
  }

  /**
   * DATA ISOLATION: Get only this parent's linked children
   * Queries parent_student_relationships strictly by parentId + schoolId
   */
  static async getLinkedChildren(parentId?: string) {
    await connectDB();
    const parent = await this.resolveParent(parentId);

    // Strict data-isolation query: only get relationships belonging to this parent
    const relationships = await ParentStudentRelationship.find({
      parentId: parent._id,
      schoolId: parent.schoolId,
    }).lean();

    if (relationships.length === 0) {
      return { parent, children: [] };
    }

    const linkedStudentIds = relationships.map((r) => r.studentId);

    // Query students strictly scoped to the linked IDs
    const children = await Student.find({
      _id: { $in: linkedStudentIds },
      schoolId: parent.schoolId,
      isActive: true,
    }).lean();

    const relMap = new Map(
      relationships.map((r) => [r.studentId.toString(), r])
    );

    const enrichedChildren = children.map((child) => {
      const rel = relMap.get(child._id.toString());
      return {
        ...child,
        relationshipType: rel?.relationship || "guardian",
        isPrimary: rel?.isPrimary ?? false,
        canReceiveAlerts: rel?.canReceiveAlerts ?? true,
        canReceiveReports: rel?.canReceiveReports ?? true,
      };
    });

    return {
      parent,
      children: enrichedChildren,
    };
  }

  /**
   * JWT-aware, school-scoped parent resolver for protected routes.
   *
   * Explicitly does NOT use the "me"/first-parent fallback of resolveParent().
   * resolveParent() is left untouched (still used by the parent dashboard
   * server component and getLinkedChildren's internal re-fetch).
   *
   * @param userId   - authenticated User _id (auth.userId from JWT)
   * @param schoolId - authenticated schoolId (auth.schoolId from JWT)
   * @returns parent document (lean) or null when no parent matches — callers
   *          decide the failure mode.
   */
  static async resolveParentByUserId(userId: string, schoolId: string) {
    await connectDB();
    return Parent.findOne({ userId, schoolId }).lean();
  }

  /**
   * AUTHORIZED READ: linked children scoped to the authenticated JWT identity.
   *
   * The JWT (auth.userId / auth.role / auth.schoolId) is the ONLY authoritative
   * identity source. The URL parentId is a resource selector, never proof of
   * ownership. Every scope failure throws the same generic FORBIDDEN error so a
   * caller cannot distinguish "no such parent" from "parent outside your scope".
   *
   * Rules:
   * - parent    : own children only — Parent resolved via
   *               { userId: auth.userId, schoolId: auth.schoolId }; URL parentId
   *               must equal the authenticated parent's _id ("me"/"current" are
   *               aliases for it — the first-parent DB fallback is never used).
   * - admin     : active Admin profile required; target parent resolved with
   *               { _id: parentId, schoolId: auth.schoolId } — cross-school
   *               parents are invisible; "me"/"current" rejected (an admin has
   *               no implicit parent identity).
   * - student / teacher / counselor / unknown roles : always denied (fail closed).
   *
   * Child data is fetched through the existing getLinkedChildren() logic with
   * the JWT-derived parent _id, so the relationship and student queries remain
   * strictly scoped to auth.schoolId.
   */
  static async getAuthorizedLinkedChildren(
    auth: AuthContext,
    parentId?: string
  ) {
    await connectDB();

    const FORBIDDEN =
      "Access denied. You are not authorized to view this parent's children.";

    switch (auth.role) {
      case "parent": {
        const ownParent = await this.resolveParentByUserId(
          auth.userId,
          auth.schoolId
        );
        if (!ownParent) throw APIError.forbidden(FORBIDDEN);
        if (
          parentId !== "me" &&
          parentId !== "current" &&
          ownParent._id.toString() !== parentId
        ) {
          throw APIError.forbidden(FORBIDDEN);
        }
        return this.getLinkedChildren(ownParent._id.toString());
      }

      case "admin": {
        if (!parentId || parentId === "me" || parentId === "current") {
          // No implicit "own parent" identity for admins — never fall back.
          throw APIError.forbidden(FORBIDDEN);
        }
        const admin = await Admin.findOne({
          userId: auth.userId,
          schoolId: auth.schoolId,
          isActive: true,
        })
          .select("_id")
          .lean();
        if (!admin) throw APIError.forbidden(FORBIDDEN);

        const isValidObjectId =
          mongoose.Types.ObjectId.isValid(parentId) &&
          /^[0-9a-fA-F]{24}$/.test(parentId);
        if (!isValidObjectId) throw APIError.forbidden(FORBIDDEN);

        // School-scoped target lookup — a School B parent is simply not found
        // for a School A admin, and both cases return the same generic 403.
        const targetParent = await Parent.findOne({
          _id: parentId,
          schoolId: auth.schoolId,
        }).lean();
        if (!targetParent) throw APIError.forbidden(FORBIDDEN);

        return this.getLinkedChildren(targetParent._id.toString());
      }

      default:
        // student, teacher, counselor and any unknown role fail closed.
        throw APIError.forbidden(FORBIDDEN);
    }
  }

  /**
   * AUTHORIZED READ: parent dashboard scoped to the verified JWT identity.
   *
   * Authorization is delegated to getAuthorizedLinkedChildren() so the
   * dashboard follows the exact same parent/admin role and school-isolation
   * rules as the protected children endpoint. The existing dashboard method
   * remains unchanged for its current server-component caller; it receives
   * only the canonical parent ID returned after authorization, never the URL
   * parentId supplied by the caller.
   */
  static async getAuthorizedParentDashboard(
    auth: AuthContext,
    parentId: string,
    requestedStudentId?: string
  ) {
    const { parent } = await this.getAuthorizedLinkedChildren(auth, parentId);

    return this.getParentDashboard(
      parent._id.toString(),
      requestedStudentId
    );
  }

  /**
   * Get Parent Dashboard Data
   * Scoped strictly to the parent's linked children
   */
  static async getParentDashboard(parentId?: string, requestedStudentId?: string) {
    await connectDB();
    const { parent, children } = await this.getLinkedChildren(parentId);

    if (children.length === 0) {
      throw APIError.notFound("No linked children found for this parent account.");
    }

    // Determine target child
    let activeChild = children[0];
    if (requestedStudentId) {
      const found = children.find(
        (c) =>
          c._id.toString() === requestedStudentId ||
          c.studentCode === requestedStudentId
      );

      // DATA ISOLATION ENFORCEMENT:
      // If parent requests a studentId that is NOT their linked child, REJECT WITH 403 FORBIDDEN!
      if (!found) {
        throw APIError.forbidden(
          `Access denied. Student '${requestedStudentId}' is not linked to your parent account.`
        );
      }
      activeChild = found;
    }

    // Fetch child's academic overview using StudentService
    const studentSummary = await StudentService.getStudentSummary(
      activeChild._id.toString()
    );

    // Fetch upcoming exams for the child's class
    const upcomingExams = await Exam.find({
      schoolId: parent.schoolId,
      classId: activeChild.classId,
    })
      .sort({ examDate: 1 })
      .limit(3)
      .populate({ path: "subjectId", select: "name" })
      .lean();

    const now = new Date();
    const upcomingExamsList = upcomingExams.map((exam, idx) => {
      const examDate = new Date(exam.examDate);
      const diffDays = Math.max(
        1,
        Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const subj = exam.subjectId as unknown as { name?: string };
      return {
        id: idx + 1,
        subject: subj?.name || "Subject",
        type: exam.type.replace(/_/g, " ").toUpperCase(),
        date: examDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        daysLeft: diffDays,
      };
    });

    // Fallback if no upcoming exams
    if (upcomingExamsList.length === 0) {
      upcomingExamsList.push(
        { id: 1, subject: "Physics", type: "Mid-Term", date: "Friday, 24 Aug", daysLeft: 2 },
        { id: 2, subject: "Mathematics", type: "Unit Test", date: "Monday, 27 Aug", daysLeft: 5 }
      );
    }

    // Bus status for active child
    const bus = await Bus.findOne({ schoolId: parent.schoolId, isActive: true }).lean();
    const busStatus = {
      status: bus ? "On Route" : "Scheduled",
      message: bus
        ? `Bus ${bus.registrationNumber} (Route ${bus.routeCode || "Main"}) on schedule`
        : "Arriving at stop in 5 mins",
      location: "Sector 14 Road",
      isDelayed: false,
    };

    // AI Weekly Summary tailored to this child
    const attendanceRate = studentSummary.attendance.percentage;
    const gpa = studentSummary.academics.overallGPA;
    const aiWeeklySummary = `${activeChild.firstName} demonstrated solid academic consistency this week with an attendance rate of ${attendanceRate}%. Average score across subject assessments is currently ${(gpa / 4 * 100).toFixed(0)}%. ${
      studentSummary.academics.overdueHomework > 0
        ? `Please check in regarding ${studentSummary.academics.overdueHomework} pending assignment(s).`
        : "All recent assignments have been completed on time. Keep up the encouragement!"
    }`;

    const overallStatus =
      attendanceRate >= 90
        ? `${activeChild.firstName} is doing great this week!`
        : `${activeChild.firstName}'s attendance requires attention.`;

    return {
      parentName: `${parent.firstName} ${parent.lastName}`,
      parentId: parent._id.toString(),
      overallStatus,
      aiWeeklySummary,
      busStatus,
      upcomingExamsList,
      student: studentSummary,
      linkedChildren: children.map((c) => ({
        id: c._id.toString(),
        studentCode: c.studentCode,
        name: `${c.firstName} ${c.lastName}`,
        grade: `${c.grade}-${c.section}`,
        relationship: (c as unknown as { relationshipType: string }).relationshipType,
      })),
    };
  }
}
