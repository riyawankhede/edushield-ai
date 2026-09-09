import { connectDB } from "@/lib/db";
import { APIError } from "@/lib/api-error";
import {
  Teacher,
  TeacherClassAssignment,
  Class,
  Subject,
  Student,
  AttendanceRecord,
  HomeworkSubmission,
  Assignment,
  ExamResult,
  Exam,
} from "@/models";
import mongoose from "mongoose";

export class TeacherService {
  /**
   * Helper: Resolve teacher by ID, staffCode, or "me"/"current" (defaults to first teacher)
   */
  static async resolveTeacher(teacherIdOrCode?: string) {
    await connectDB();

    if (!teacherIdOrCode || teacherIdOrCode === "me" || teacherIdOrCode === "current") {
      const teacher = await Teacher.findOne({ isActive: true }).lean();
      if (!teacher) throw APIError.notFound("No active teachers found in database.");
      return teacher;
    }

    const isObjectId =
      mongoose.Types.ObjectId.isValid(teacherIdOrCode) &&
      /^[0-9a-fA-F]{24}$/.test(teacherIdOrCode);

    const query = isObjectId
      ? { _id: teacherIdOrCode }
      : {
          $or: [
            { staffCode: teacherIdOrCode },
            { staffCode: teacherIdOrCode.replace("STF-0", "STF-") },
          ],
        };

    const teacher = await Teacher.findOne(query).lean();
    if (!teacher) throw APIError.notFound(`Teacher '${teacherIdOrCode}' not found.`);
    return teacher;
  }

  /**
   * Resolve an ACTIVE teacher by authenticated User identity + school.
   *
   * JWT-aware, school-scoped resolver used by protected write routes.
   * Explicitly does NOT use the "me"/first-active-teacher fallback.
   *
   * @param userId   - authenticated User _id (auth.userId from JWT)
   * @param schoolId - authenticated User schoolId (auth.schoolId from JWT)
   * @returns teacher document (lean) or null when no active teacher matches
   */
  static async resolveTeacherByUserId(userId: string, schoolId: string) {
    await connectDB();
    return Teacher.findOne({
      userId,
      schoolId,
      isActive: true,
    }).lean();
  }

  /**
   * DATA ISOLATION: Resolve only the classes/subjects this teacher is assigned to.
   *
   * Strict isolation query — two conditions required:
   *   1. teacherId = this teacher's _id
   *   2. schoolId  = this teacher's schoolId
   *
   * No other teacher's assignments are ever returned.
   */
  static async getAssignedScope(teacher: { _id: unknown; schoolId: unknown }) {
    await connectDB();

    // THE ISOLATION QUERY — only this teacher's rows in teacher_class_assignments
    const assignments = await TeacherClassAssignment.find({
      teacherId: teacher._id,
      schoolId: teacher.schoolId,
      isActive: true,
    }).lean();

    const classIds = [...new Set(assignments.map((a) => a.classId.toString()))];
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId.toString()))];

    const [classes, subjects] = await Promise.all([
      Class.find({ _id: { $in: classIds }, schoolId: teacher.schoolId }).lean(),
      Subject.find({ _id: { $in: subjectIds }, schoolId: teacher.schoolId }).lean(),
    ]);

    return { assignments, classIds, subjectIds, classes, subjects };
  }

  /**
   * WRITE-GUARD: Verify a teacher is assigned to a specific class+subject before allowing writes.
   * Called before any attendance-mark, marks-entry, or homework-create operation.
   */
  static async verifyAssignment(
    teacher: { _id: unknown; schoolId: unknown },
    classId: string,
    subjectId?: string
  ) {
    await connectDB();
    const filter: Record<string, unknown> = {
      teacherId: teacher._id,
      classId,
      schoolId: teacher.schoolId,
      isActive: true,
    };
    if (subjectId) filter.subjectId = subjectId;

    const assignment = await TeacherClassAssignment.findOne(filter).lean();
    if (!assignment) {
      throw APIError.forbidden(
        "You are not assigned to this class/subject. Write operation denied."
      );
    }
    return assignment;
  }

  /**
   * Get Teacher Dashboard Data
   * All data strictly scoped to this teacher's assigned classes.
   */
  static async getTeacherDashboard(teacherIdOrCode?: string) {
    await connectDB();
    const teacher = await this.resolveTeacher(teacherIdOrCode);
    const { assignments, classIds, subjectIds, classes, subjects } =
      await this.getAssignedScope(teacher);

    // No classes assigned yet
    if (classIds.length === 0) {
      return this.buildEmptyDashboard(teacher);
    }

    const classObjectIds = classIds.map((id) => new mongoose.Types.ObjectId(id));
    const subjectObjectIds = subjectIds.map((id) => new mongoose.Types.ObjectId(id));

    // 1. Total students across all assigned classes
    const [totalStudents, studentsRaw] = await Promise.all([
      Student.countDocuments({
        classId: { $in: classObjectIds },
        schoolId: teacher.schoolId,
        isActive: true,
      }),
      Student.find(
        { classId: { $in: classObjectIds }, schoolId: teacher.schoolId, isActive: true },
        { _id: 1, firstName: 1, lastName: 1, classId: 1, studentCode: 1 }
      )
        .limit(200)
        .lean(),
    ]);

    // 2. Attendance pending: classes that have no attendance records for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendanceClassIds = await AttendanceRecord.distinct("classId", {
      classId: { $in: classObjectIds },
      schoolId: teacher.schoolId,
      date: { $gte: today, $lt: tomorrow },
    });

    const pendingAttendanceClasses = classes.filter(
      (c) => !todayAttendanceClassIds.map((id) => id.toString()).includes(c._id.toString())
    );

    // 3. Homework pending review: submissions with status "submitted" for this teacher's assignments
    const teacherAssignmentDocs = await Assignment.find({
      teacherId: teacher._id,
      schoolId: teacher.schoolId,
    })
      .select("_id title subjectId classId dueDate")
      .lean();

    const teacherAssignmentIds = teacherAssignmentDocs.map((a) => a._id);
    const pendingReviewCount = await HomeworkSubmission.countDocuments({
      assignmentId: { $in: teacherAssignmentIds },
      status: "submitted",
    });

    // 4. Students requiring attention — low attendance (<80%) or recent low scores
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const studentIds = studentsRaw.map((s) => s._id);
    const classMap = new Map(classes.map((c) => [c._id.toString(), c.name]));
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s.name]));

    // Compute attendance rate per student from recent 30 days
    const attendanceAgg = await AttendanceRecord.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          schoolId: teacher.schoolId,
          date: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$studentId",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        },
      },
    ]);

    const attendanceMap = new Map(
      attendanceAgg.map((a) => [
        a._id.toString(),
        a.total > 0 ? Math.round((a.present / a.total) * 100) : 100,
      ])
    );

    // Compute average exam score per student for this teacher's subjects
    const examScoreAgg = await ExamResult.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          subjectId: { $in: subjectObjectIds },
          schoolId: teacher.schoolId,
        },
      },
      {
        $group: {
          _id: "$studentId",
          avgScore: { $avg: "$marksObtained" },
        },
      },
    ]);

    const examScoreMap = new Map(
      examScoreAgg.map((e) => [
        e._id.toString(),
        e.avgScore > 0 ? Math.round((e.avgScore / 25) * 100) : 75,
      ])
    );

    const studentsRequiringAttention = studentsRaw
      .filter((s) => {
        const attRate = attendanceMap.get(s._id.toString()) ?? 100;
        const score = examScoreMap.get(s._id.toString()) ?? 100;
        return attRate < 80 || score < 60;
      })
      .slice(0, 7)
      .map((s) => {
        const attRate = attendanceMap.get(s._id.toString()) ?? 100;
        const score = examScoreMap.get(s._id.toString()) ?? 100;
        const cls = classMap.get(s.classId?.toString() || "") ?? "–";
        const isCritical = attRate < 70 || score < 50;
        return {
          id: s._id.toString(),
          name: `${s.firstName} ${s.lastName}`,
          studentCode: s.studentCode,
          class: cls,
          indicator:
            attRate < 80
              ? `Attendance Risk: ${isCritical ? "High" : "Medium"}`
              : `Performance Trend: Declining`,
          stat: `Attendance: ${attRate}%`,
          weakArea: teacher.subjectSpecialization || "",
          status: isCritical ? "Critical" : "Warning",
        };
      });

    // 5. Classes today schedule (from assignments, one per class)
    const classTimes = ["09:00 AM", "10:15 AM", "11:30 AM", "01:00 PM", "02:15 PM"];
    const classRooms = ["Room 101", "Room 204", "Lab 2", "Room 301", "Room 102"];

    const classesToday = assignments.slice(0, 4).map((asg, idx) => ({
      id: idx + 1,
      time: classTimes[idx % classTimes.length],
      subject: subjectMap.get(asg.subjectId.toString()) || teacher.subjectSpecialization,
      class: classMap.get(asg.classId.toString()) || "–",
      room: classRooms[idx % classRooms.length],
      status: idx === 0 ? "Completed" : idx === 1 ? "In Progress" : "Upcoming",
    }));

    // 6. Attendance tasks (per class)
    const todayMarkedSet = new Set(todayAttendanceClassIds.map((id) => id.toString()));
    const attendanceTasks = classes.slice(0, 5).map((cls, idx) => {
      const isMarked = todayMarkedSet.has(cls._id.toString());
      const total = studentsRaw.filter(
        (s) => s.classId?.toString() === cls._id.toString()
      ).length;
      return {
        id: idx + 1,
        class: cls.name,
        marked: isMarked ? total : 0,
        total,
        pending: isMarked ? 0 : total,
        status: isMarked ? "completed" : "pending",
      };
    });

    // 7. Academic performance by class
    const classPerformance = await Promise.all(
      classes.slice(0, 5).map(async (cls) => {
        const classStudentIds = studentsRaw
          .filter((s) => s.classId?.toString() === cls._id.toString())
          .map((s) => s._id);

        const scores = await ExamResult.find({
          studentId: { $in: classStudentIds },
          subjectId: { $in: subjectObjectIds },
          schoolId: teacher.schoolId,
        })
          .select("marksObtained")
          .lean();

        if (scores.length === 0) {
          return { name: cls.name, average: 75, improved: 60, stable: 30, declined: 10 };
        }
        const avg = Math.round(
          (scores.reduce((sum, s) => sum + (s.marksObtained / 25) * 100, 0) /
            scores.length)
        );
        return { name: cls.name, average: Math.min(100, avg), improved: 60, stable: 30, declined: 10 };
      })
    );

    // 8. Homework review list
    const homeworkReview = teacherAssignmentDocs.slice(0, 4).map((asg) => ({
      id: asg._id.toString(),
      subject: subjectMap.get(asg.subjectId?.toString() || "") || teacher.subjectSpecialization,
      assignment: asg.title,
      submissions: Math.floor(Math.random() * 30) + 10, // will refine in Phase 5
      pending: pendingReviewCount > 0 ? Math.floor(pendingReviewCount / teacherAssignmentDocs.length) : 0,
      status: pendingReviewCount > 0 ? "pending" : "completed",
    }));

    // 9. Upcoming exams for this teacher's subjects
    const upcomingExams = await Exam.find({
      subjectId: { $in: subjectObjectIds },
      schoolId: teacher.schoolId,
      examDate: { $gte: new Date() },
    })
      .sort({ examDate: 1 })
      .limit(3)
      .populate({ path: "subjectId", select: "name" })
      .lean();

    const upcomingExamsList = upcomingExams.map((exam, idx) => {
      const s = exam.subjectId as unknown as { name?: string };
      return {
        id: idx + 1,
        subject: s?.name || teacher.subjectSpecialization,
        date: new Date(exam.examDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        class: classMap.get(exam.classId?.toString() || "") || "–",
      };
    });

    return {
      id: teacher._id.toString(),
      staffCode: teacher.staffCode,
      name: `${teacher.firstName} ${teacher.lastName}`,
      role: `${teacher.subjectSpecialization} Teacher`,
      academicYear: "2026–27",
      metrics: {
        totalStudents,
        attendancePending: pendingAttendanceClasses.length,
        homeworkPendingReview: pendingReviewCount,
        studentsRequiringAttention: studentsRequiringAttention.length,
      },
      classesToday: classesToday.length > 0 ? classesToday : [
        { id: 1, time: "09:00 AM", subject: teacher.subjectSpecialization, class: classes[0]?.name || "–", room: "Room 101", status: "Upcoming" },
      ],
      attendanceTasks: attendanceTasks.length > 0 ? attendanceTasks : [],
      studentsRequiringAttention,
      academicPerformance: {
        classes: classPerformance,
        trend: { improving: 62, stable: 25, declining: 13 },
      },
      homeworkReview,
      upcomingExams: upcomingExamsList,
      // Static for Phase 4 — AI insights come in Phase 6 ML integration
      aiInsights: [
        {
          id: 1,
          type: "Performance Trend",
          message: `${studentsRequiringAttention.filter((s) => s.status === "Critical").length} students show declining performance in ${teacher.subjectSpecialization}.`,
          severity: "high",
          count: studentsRequiringAttention.filter((s) => s.status === "Critical").length,
          time: "2 hours ago",
        },
        {
          id: 2,
          type: "Attendance Alert",
          message: `${studentsRequiringAttention.filter((s) => s.indicator.includes("Attendance")).length} students have attendance below threshold.`,
          severity: "medium",
          count: studentsRequiringAttention.filter((s) => s.indicator.includes("Attendance")).length,
          time: "4 hours ago",
        },
      ],
      parentMessages: [],
      recentActivity: [],
      // Expose assigned classes for the UI class-filter dropdown
      assignedClasses: classes.map((c) => ({ id: c._id.toString(), name: c.name })),
    };
  }

  private static buildEmptyDashboard(teacher: {
    _id: unknown;
    staffCode?: string;
    firstName?: string;
    lastName?: string;
    subjectSpecialization?: string;
  }) {
    return {
      id: teacher._id?.toString(),
      staffCode: teacher.staffCode,
      name: `${teacher.firstName} ${teacher.lastName}`,
      role: `${teacher.subjectSpecialization} Teacher`,
      academicYear: "2026–27",
      metrics: { totalStudents: 0, attendancePending: 0, homeworkPendingReview: 0, studentsRequiringAttention: 0 },
      classesToday: [],
      attendanceTasks: [],
      studentsRequiringAttention: [],
      academicPerformance: { classes: [], trend: { improving: 0, stable: 0, declining: 0 } },
      homeworkReview: [],
      upcomingExams: [],
      aiInsights: [],
      parentMessages: [],
      recentActivity: [],
      assignedClasses: [],
    };
  }
}
