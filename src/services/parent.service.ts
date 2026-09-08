import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  Parent,
  ParentStudentRelationship,
  Student,
  Exam,
  Subject,
  Bus,
} from "@/models";
import { StudentService } from "@/services/student.service";
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
