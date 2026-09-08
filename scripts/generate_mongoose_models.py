#!/usr/bin/env python3
"""
Mongoose Models Generator for EduShield AI
Generates all canonical Mongoose models in src/models/*.ts matching
docs/MONGODB_SCHEMA_DESIGN.md and AGENTS.md rules.
"""

import os

MODELS_DIR = os.path.join("src", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

models = {}

# 1. User
models["User.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IUser } from "@/types/identity";

export interface IUserDocument extends Omit<IUser, "_id">, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["student", "parent", "teacher", "counselor", "admin"],
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

UserSchema.index({ schoolId: 1, role: 1 });

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);

export default User;
'''

# 2. School
models["School.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ISchool } from "@/types/operations";

export interface ISchoolDocument extends Omit<ISchool, "_id">, Document {}

const SchoolSchema = new Schema<ISchoolDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    address: {
      type: String,
      maxlength: 500,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
    },
    academicYearCurrent: {
      type: String,
      required: true,
      default: "2025-26",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "schools",
  }
);

const School: Model<ISchoolDocument> =
  mongoose.models.School || mongoose.model<ISchoolDocument>("School", SchoolSchema);

export default School;
'''

# 3. Student
models["Student.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudent } from "@/types/identity";

export interface IStudentDocument extends Omit<IStudent, "_id">, Document {}

const StudentSchema = new Schema<IStudentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
    },
    grade: {
      type: String,
      required: true,
      maxlength: 20,
    },
    section: {
      type: String,
      required: true,
      maxlength: 10,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    enrollmentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emergencyContact: {
      name: { type: String, maxlength: 150 },
      phone: { type: String, maxlength: 30 },
      relationship: { type: String, maxlength: 50 },
    },
    address: {
      street: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      postalCode: { type: String, maxlength: 20 },
    },
    profileImageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "students",
  }
);

StudentSchema.index({ schoolId: 1, grade: 1, section: 1 });
StudentSchema.index({ schoolId: 1, studentCode: 1 }, { unique: true });

const Student: Model<IStudentDocument> =
  mongoose.models.Student || mongoose.model<IStudentDocument>("Student", StudentSchema);

export default Student;
'''

# 4. Parent
models["Parent.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IParent } from "@/types/identity";

export interface IParentDocument extends Omit<IParent, "_id">, Document {}

const ParentSchema = new Schema<IParentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      maxlength: 30,
    },
    occupation: {
      type: String,
      maxlength: 100,
    },
    preferredLanguage: {
      type: String,
      default: "en",
      maxlength: 20,
    },
  },
  {
    timestamps: true,
    collection: "parents",
  }
);

ParentSchema.index({ schoolId: 1 });

const Parent: Model<IParentDocument> =
  mongoose.models.Parent || mongoose.model<IParentDocument>("Parent", ParentSchema);

export default Parent;
'''

# 5. ParentStudentRelationship
models["ParentStudentRelationship.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IParentStudentRelationship } from "@/types/identity";

export interface IParentStudentRelationshipDocument
  extends Omit<IParentStudentRelationship, "_id">,
    Document {}

const ParentStudentRelationshipSchema = new Schema<IParentStudentRelationshipDocument>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    relationship: {
      type: String,
      required: true,
      enum: ["mother", "father", "guardian", "other"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    canReceiveAlerts: {
      type: Boolean,
      default: true,
    },
    canReceiveReports: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "parent_student_relationships",
  }
);

ParentStudentRelationshipSchema.index({ parentId: 1, studentId: 1 }, { unique: true });
ParentStudentRelationshipSchema.index({ studentId: 1 });
ParentStudentRelationshipSchema.index({ schoolId: 1 });

const ParentStudentRelationship: Model<IParentStudentRelationshipDocument> =
  mongoose.models.ParentStudentRelationship ||
  mongoose.model<IParentStudentRelationshipDocument>(
    "ParentStudentRelationship",
    ParentStudentRelationshipSchema
  );

export default ParentStudentRelationship;
'''

# 6. Teacher
models["Teacher.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ITeacher } from "@/types/identity";

export interface ITeacherDocument extends Omit<ITeacher, "_id">, Document {}

const TeacherSchema = new Schema<ITeacherDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    staffCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      maxlength: 30,
    },
    qualification: {
      type: String,
      maxlength: 200,
    },
    specializations: [{
      type: String,
      maxlength: 100,
    }],
    subjectSpecialization: {
      type: String,
      maxlength: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "teachers",
  }
);

TeacherSchema.index({ schoolId: 1 });
TeacherSchema.index({ schoolId: 1, staffCode: 1 }, { unique: true });

const Teacher: Model<ITeacherDocument> =
  mongoose.models.Teacher || mongoose.model<ITeacherDocument>("Teacher", TeacherSchema);

export default Teacher;
'''

# 7. TeacherClassAssignment
models["TeacherClassAssignment.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ITeacherClassAssignment } from "@/types/identity";

export interface ITeacherClassAssignmentDocument
  extends Omit<ITeacherClassAssignment, "_id">,
    Document {}

const TeacherClassAssignmentSchema = new Schema<ITeacherClassAssignmentDocument>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "teacher_class_assignments",
  }
);

TeacherClassAssignmentSchema.index(
  { teacherId: 1, classId: 1, subjectId: 1, academicYear: 1 },
  { unique: true }
);
TeacherClassAssignmentSchema.index({ teacherId: 1 });
TeacherClassAssignmentSchema.index({ classId: 1, subjectId: 1 });
TeacherClassAssignmentSchema.index({ schoolId: 1, academicYear: 1 });

const TeacherClassAssignment: Model<ITeacherClassAssignmentDocument> =
  mongoose.models.TeacherClassAssignment ||
  mongoose.model<ITeacherClassAssignmentDocument>(
    "TeacherClassAssignment",
    TeacherClassAssignmentSchema
  );

export default TeacherClassAssignment;
'''

# 8. Counselor
models["Counselor.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ICounselor } from "@/types/identity";

export interface ICounselorDocument extends Omit<ICounselor, "_id">, Document {}

const CounselorSchema = new Schema<ICounselorDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    staffCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      maxlength: 30,
    },
    qualification: {
      type: String,
      maxlength: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "counselors",
  }
);

CounselorSchema.index({ schoolId: 1 });

const Counselor: Model<ICounselorDocument> =
  mongoose.models.Counselor ||
  mongoose.model<ICounselorDocument>("Counselor", CounselorSchema);

export default Counselor;
'''

# 9. Admin
models["Admin.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAdmin } from "@/types/identity";

export interface IAdminDocument extends Omit<IAdmin, "_id">, Document {}

const AdminSchema = new Schema<IAdminDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    staffCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      maxlength: 30,
    },
    adminLevel: {
      type: String,
      enum: ["school", "super"],
      default: "school",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

AdminSchema.index({ schoolId: 1 });

const Admin: Model<IAdminDocument> =
  mongoose.models.Admin || mongoose.model<IAdminDocument>("Admin", AdminSchema);

export default Admin;
'''

# 10. Class
models["Class.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IClass } from "@/types/academic";

export interface IClassDocument extends Omit<IClass, "_id">, Document {}

const ClassSchema = new Schema<IClassDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    grade: {
      type: String,
      required: true,
      maxlength: 20,
    },
    section: {
      type: String,
      required: true,
      maxlength: 10,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    roomNumber: {
      type: String,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "classes",
  }
);

ClassSchema.index(
  { schoolId: 1, grade: 1, section: 1, academicYear: 1 },
  { unique: true }
);

const ClassModel: Model<IClassDocument> =
  mongoose.models.Class || mongoose.model<IClassDocument>("Class", ClassSchema);

export default ClassModel;
'''

# 11. Subject
models["Subject.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ISubject } from "@/types/academic";

export interface ISubjectDocument extends Omit<ISubject, "_id">, Document {}

const SubjectSchema = new Schema<ISubjectDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    gradeLevel: {
      type: String,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "subjects",
  }
);

SubjectSchema.index({ schoolId: 1, code: 1 }, { unique: true });

const Subject: Model<ISubjectDocument> =
  mongoose.models.Subject || mongoose.model<ISubjectDocument>("Subject", SubjectSchema);

export default Subject;
'''

# 12. Enrollment
models["Enrollment.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IEnrollment } from "@/types/academic";

export interface IEnrollmentDocument extends Omit<IEnrollment, "_id">, Document {}

const EnrollmentSchema = new Schema<IEnrollmentDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "enrollments",
  }
);

EnrollmentSchema.index({ studentId: 1, classId: 1, academicYear: 1 }, { unique: true });
EnrollmentSchema.index({ studentId: 1, academicYear: 1 });
EnrollmentSchema.index({ classId: 1, academicYear: 1 });

const Enrollment: Model<IEnrollmentDocument> =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollmentDocument>("Enrollment", EnrollmentSchema);

export default Enrollment;
'''

# 13. Exam
models["Exam.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IExam } from "@/types/academic";

export interface IExamDocument extends Omit<IExam, "_id">, Document {}

const ExamSchema = new Schema<IExamDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      required: true,
      enum: ["unit_test", "mid_term", "final", "assignment", "quiz", "practical"],
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    examDate: {
      type: Date,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "exams",
  }
);

ExamSchema.index({ classId: 1, subjectId: 1, academicYear: 1 });
ExamSchema.index({ schoolId: 1, examDate: 1 });

const Exam: Model<IExamDocument> =
  mongoose.models.Exam || mongoose.model<IExamDocument>("Exam", ExamSchema);

export default Exam;
'''

# 14. ExamResult
models["ExamResult.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IExamResult } from "@/types/academic";

export interface IExamResultDocument extends Omit<IExamResult, "_id">, Document {}

const ExamResultSchema = new Schema<IExamResultDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0,
    },
    grade: {
      type: String,
      maxlength: 10,
    },
    isPassed: {
      type: Boolean,
    },
    remarks: {
      type: String,
      maxlength: 1000,
    },
    enteredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "exam_results",
  }
);

ExamResultSchema.index({ studentId: 1, examId: 1 }, { unique: true });
ExamResultSchema.index({ examId: 1 });
ExamResultSchema.index({ studentId: 1, schoolId: 1 });

const ExamResult: Model<IExamResultDocument> =
  mongoose.models.ExamResult ||
  mongoose.model<IExamResultDocument>("ExamResult", ExamResultSchema);

export default ExamResult;
'''

# 15. Assignment
models["Assignment.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAssignment } from "@/types/academic";

export interface IAssignmentDocument extends Omit<IAssignment, "_id">, Document {}

const AssignmentSchema = new Schema<IAssignmentDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 3000,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    maxMarks: {
      type: Number,
      min: 0,
      default: 20,
    },
    attachments: [{
      type: String,
    }],
    type: {
      type: String,
      enum: ["homework", "project", "classwork", "reading"],
      default: "homework",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "assignments",
  }
);

AssignmentSchema.index({ classId: 1, dueDate: 1 });
AssignmentSchema.index({ teacherId: 1 });
AssignmentSchema.index({ schoolId: 1, createdAt: 1 });

const Assignment: Model<IAssignmentDocument> =
  mongoose.models.Assignment ||
  mongoose.model<IAssignmentDocument>("Assignment", AssignmentSchema);

export default Assignment;
'''

# 16. HomeworkSubmission
models["HomeworkSubmission.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IHomeworkSubmission } from "@/types/academic";

export interface IHomeworkSubmissionDocument
  extends Omit<IHomeworkSubmission, "_id">,
    Document {}

const HomeworkSubmissionSchema = new Schema<IHomeworkSubmissionDocument>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    content: {
      type: String,
      maxlength: 5000,
    },
    attachmentUrls: [{
      type: String,
    }],
    marksAwarded: {
      type: Number,
      min: 0,
    },
    feedback: {
      type: String,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["submitted", "late", "graded", "missing"],
      default: "missing",
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    gradedAt: {
      type: Date,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "homework_submissions",
  }
);

HomeworkSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
HomeworkSubmissionSchema.index({ assignmentId: 1 });
HomeworkSubmissionSchema.index({ studentId: 1, status: 1 });

const HomeworkSubmission: Model<IHomeworkSubmissionDocument> =
  mongoose.models.HomeworkSubmission ||
  mongoose.model<IHomeworkSubmissionDocument>(
    "HomeworkSubmission",
    HomeworkSubmissionSchema
  );

export default HomeworkSubmission;
'''

# 17. StudyMaterial
models["StudyMaterial.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudyMaterial } from "@/types/academic";

export interface IStudyMaterialDocument
  extends Omit<IStudyMaterial, "_id">,
    Document {}

const StudyMaterialSchema = new Schema<IStudyMaterialDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    grade: {
      type: String,
      required: true,
      maxlength: 20,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      maxlength: 3000,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "video", "slide", "link", "image", "document"],
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [{
      type: String,
      maxlength: 50,
    }],
    isPublished: {
      type: Boolean,
      default: false,
    },
    embedding: {
      type: [Number],
      select: false, // Vector embedding excluded by default for performance
    },
    embeddingModel: {
      type: String,
      maxlength: 100,
    },
    embeddingGeneratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "study_materials",
  }
);

StudyMaterialSchema.index({ subjectId: 1, grade: 1 });
StudyMaterialSchema.index({ schoolId: 1, isPublished: 1 });

const StudyMaterial: Model<IStudyMaterialDocument> =
  mongoose.models.StudyMaterial ||
  mongoose.model<IStudyMaterialDocument>("StudyMaterial", StudyMaterialSchema);

export default StudyMaterial;
'''

# 18. AttendanceRecord
models["AttendanceRecord.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAttendanceRecord } from "@/types/attendance";

export interface IAttendanceRecordDocument
  extends Omit<IAttendanceRecord, "_id">,
    Document {}

const AttendanceRecordSchema = new Schema<IAttendanceRecordDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["present", "absent", "late", "excused"],
    },
    remarks: {
      type: String,
      maxlength: 500,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "attendance_records",
  }
);

AttendanceRecordSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });
AttendanceRecordSchema.index({ classId: 1, date: 1 });
AttendanceRecordSchema.index({ studentId: 1, schoolId: 1, date: 1 });

const AttendanceRecord: Model<IAttendanceRecordDocument> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecordDocument>("AttendanceRecord", AttendanceRecordSchema);

export default AttendanceRecord;
'''

# 19. LeaveRequest
models["LeaveRequest.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ILeaveRequest } from "@/types/attendance";

export interface ILeaveRequestDocument
  extends Omit<ILeaveRequest, "_id">,
    Document {}

const LeaveRequestSchema = new Schema<ILeaveRequestDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewerRemarks: {
      type: String,
      maxlength: 1000,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "leave_requests",
  }
);

LeaveRequestSchema.index({ studentId: 1 });
LeaveRequestSchema.index({ schoolId: 1, status: 1 });
LeaveRequestSchema.index({ fromDate: 1 });

const LeaveRequest: Model<ILeaveRequestDocument> =
  mongoose.models.LeaveRequest ||
  mongoose.model<ILeaveRequestDocument>("LeaveRequest", LeaveRequestSchema);

export default LeaveRequest;
'''

# 20. MoodCheckin
models["MoodCheckin.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IMoodCheckin } from "@/types/wellbeing";

export interface IMoodCheckinDocument
  extends Omit<IMoodCheckin, "_id">,
    Document {}

const MoodCheckinSchema = new Schema<IMoodCheckinDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    moodScore: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    moodLabel: {
      type: String,
      required: true,
      enum: ["great", "good", "okay", "low", "struggling"],
    },
    notes: {
      type: String,
      maxlength: 2000,
      select: false, // Protected field — restricted to counselors
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    nlpAnalyzed: {
      type: Boolean,
      default: false,
    },
    nlpAnalyzedAt: {
      type: Date,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "mood_checkins",
  }
);

MoodCheckinSchema.index({ studentId: 1, date: 1 }, { unique: true });
MoodCheckinSchema.index({ schoolId: 1, date: 1 });
MoodCheckinSchema.index({ nlpAnalyzed: 1, createdAt: 1 });

const MoodCheckin: Model<IMoodCheckinDocument> =
  mongoose.models.MoodCheckin ||
  mongoose.model<IMoodCheckinDocument>("MoodCheckin", MoodCheckinSchema);

export default MoodCheckin;
'''

# 21. WellbeingSignal
models["WellbeingSignal.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IWellbeingSignal } from "@/types/wellbeing";

export interface IWellbeingSignalDocument
  extends Omit<IWellbeingSignal, "_id">,
    Document {}

const WellbeingSignalSchema = new Schema<IWellbeingSignalDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    sourceCheckinId: {
      type: Schema.Types.ObjectId,
      ref: "MoodCheckin",
      required: true,
    },
    signalType: {
      type: String,
      required: true,
      enum: ["distress", "isolation", "aggression", "bullying_indicator", "anxiety", "positive"],
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high"],
    },
    modelVersion: {
      type: String,
      required: true,
      maxlength: 100,
    },
    requiresCounselorReview: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      maxlength: 2000,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "wellbeing_signals",
  }
);

WellbeingSignalSchema.index({ studentId: 1 });
WellbeingSignalSchema.index({ requiresCounselorReview: 1, severity: 1 });
WellbeingSignalSchema.index({ schoolId: 1, createdAt: 1 });

const WellbeingSignal: Model<IWellbeingSignalDocument> =
  mongoose.models.WellbeingSignal ||
  mongoose.model<IWellbeingSignalDocument>("WellbeingSignal", WellbeingSignalSchema);

export default WellbeingSignal;
'''

# 22. SafetyReport
models["SafetyReport.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyReport } from "@/types/safety";

export interface ISafetyReportDocument
  extends Omit<ISafetyReport, "_id">,
    Document {}

const SafetyReportSchema = new Schema<ISafetyReportDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    reporterStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
    },
    isAnonymous: {
      type: Boolean,
      required: true,
      default: false,
    },
    reportType: {
      type: String,
      required: true,
      enum: ["bullying", "physical_threat", "unsafe_area", "self_harm_concern", "other"],
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    locationDescription: {
      type: String,
      maxlength: 500,
    },
    involvedParties: [{
      type: String,
      maxlength: 200,
    }],
    attachmentUrls: [{
      type: String,
    }],
    status: {
      type: String,
      enum: ["new", "under_review", "resolved", "closed"],
      default: "new",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    nlpAnalyzed: {
      type: Boolean,
      default: false,
    },
    nlpSignals: {
      signalType: { type: String },
      confidence: { type: Number },
      severity: { type: String },
      modelVersion: { type: String },
    },
  },
  {
    timestamps: true,
    collection: "safety_reports",
  }
);

SafetyReportSchema.index({ schoolId: 1, status: 1 });
SafetyReportSchema.index({ assignedTo: 1 });
SafetyReportSchema.index({ schoolId: 1, createdAt: 1 });

const SafetyReport: Model<ISafetyReportDocument> =
  mongoose.models.SafetyReport ||
  mongoose.model<ISafetyReportDocument>("SafetyReport", SafetyReportSchema);

export default SafetyReport;
'''

# 23. SafetyIncident
models["SafetyIncident.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyIncident } from "@/types/safety";

export interface ISafetyIncidentDocument
  extends Omit<ISafetyIncident, "_id">,
    Document {}

const SafetyIncidentSchema = new Schema<ISafetyIncidentDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    incidentType: {
      type: String,
      required: true,
      enum: [
        "bullying",
        "physical_altercation",
        "theft",
        "vandalism",
        "threat",
        "medical",
        "other",
      ],
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    location: {
      description: { type: String, maxlength: 300 },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          required: false,
        },
      },
    },
    incidentDate: {
      type: Date,
      required: true,
    },
    involvedStudentIds: [{
      type: Schema.Types.ObjectId,
      ref: "Student",
    }],
    involvedStaffIds: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved"],
      default: "open",
    },
    resolution: {
      type: String,
      maxlength: 3000,
    },
  },
  {
    timestamps: true,
    collection: "safety_incidents",
  }
);

SafetyIncidentSchema.index({ schoolId: 1, incidentDate: 1 });
SafetyIncidentSchema.index({ "location.coordinates": "2dsphere" });

const SafetyIncident: Model<ISafetyIncidentDocument> =
  mongoose.models.SafetyIncident ||
  mongoose.model<ISafetyIncidentDocument>("SafetyIncident", SafetyIncidentSchema);

export default SafetyIncident;
'''

# 24. SafetyHotspot
models["SafetyHotspot.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyHotspot } from "@/types/safety";

export interface ISafetyHotspotDocument
  extends Omit<ISafetyHotspot, "_id">,
    Document {}

const SafetyHotspotSchema = new Schema<ISafetyHotspotDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    centroid: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    radiusMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    incidentCount: {
      type: Number,
      required: true,
      min: 1,
    },
    incidentIds: [{
      type: Schema.Types.ObjectId,
      ref: "SafetyIncident",
    }],
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    modelVersion: {
      type: String,
      required: true,
      maxlength: 100,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "safety_hotspots",
  }
);

SafetyHotspotSchema.index({ schoolId: 1, isActive: 1 });
SafetyHotspotSchema.index({ centroid: "2dsphere" });

const SafetyHotspot: Model<ISafetyHotspotDocument> =
  mongoose.models.SafetyHotspot ||
  mongoose.model<ISafetyHotspotDocument>("SafetyHotspot", SafetyHotspotSchema);

export default SafetyHotspot;
'''

# 25. Bus
models["Bus.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IBus } from "@/types/transport";

export interface IBusDocument extends Omit<IBus, "_id">, Document {}

const BusSchema = new Schema<IBusDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    make: {
      type: String,
      maxlength: 100,
    },
    model: {
      type: String,
      maxlength: 100,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentDriverId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 100,
    },
    routeCode: {
      type: String,
      maxlength: 50,
    },
  },
  {
    timestamps: true,
    collection: "buses",
  }
);

BusSchema.index({ schoolId: 1, isActive: 1 });

const Bus: Model<IBusDocument> =
  mongoose.models.Bus || mongoose.model<IBusDocument>("Bus", BusSchema);

export default Bus;
'''

# 26. BusRoute
models["BusRoute.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IBusRoute } from "@/types/transport";

export interface IBusRouteDocument extends Omit<IBusRoute, "_id">, Document {}

const BusRouteSchema = new Schema<IBusRouteDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    routeName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    routeCode: {
      type: String,
      required: true,
      uppercase: true,
      maxlength: 50,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stops: [{
      stopName: { type: String, required: true, maxlength: 200 },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true },
      },
      scheduledArrival: { type: String, maxlength: 10 },
      scheduledDeparture: { type: String, maxlength: 10 },
      order: { type: Number, required: true },
    }],
    estimatedDurationMinutes: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "bus_routes",
  }
);

BusRouteSchema.index({ schoolId: 1, routeCode: 1 }, { unique: true });
BusRouteSchema.index({ busId: 1 });

const BusRoute: Model<IBusRouteDocument> =
  mongoose.models.BusRoute || mongoose.model<IBusRouteDocument>("BusRoute", BusRouteSchema);

export default BusRoute;
'''

# 27. GpsEvent
models["GpsEvent.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IGpsEvent } from "@/types/transport";

export interface IGpsEventDocument extends Omit<IGpsEvent, "_id">, Document {}

const GpsEventSchema = new Schema<IGpsEventDocument>(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      maxlength: 100,
    },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    speed: {
      type: Number,
      min: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    altitude: {
      type: Number,
    },
    accuracy: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["location", "stop", "ignition_on", "ignition_off", "panic", "geofence"],
      default: "location",
    },
  },
  {
    timestamps: false, // Event-only high-frequency collection
    collection: "gps_events",
  }
);

GpsEventSchema.index({ busId: 1, timestamp: 1 });
GpsEventSchema.index({ deviceId: 1, timestamp: 1 });
GpsEventSchema.index({ coordinates: "2dsphere" });
// TTL Index: 90 days retention (7,776,000 seconds)
GpsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

const GpsEvent: Model<IGpsEventDocument> =
  mongoose.models.GpsEvent || mongoose.model<IGpsEventDocument>("GpsEvent", GpsEventSchema);

export default GpsEvent;
'''

# 28. BusAnomaly
models["BusAnomaly.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IBusAnomaly } from "@/types/transport";

export interface IBusAnomalyDocument extends Omit<IBusAnomaly, "_id">, Document {}

const BusAnomalySchema = new Schema<IBusAnomalyDocument>(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    busRouteId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
    },
    anomalyType: {
      type: String,
      required: true,
      enum: [
        "route_deviation",
        "unexpected_stop",
        "excessive_speed",
        "extended_idle",
        "panic_button",
        "geofence_violation",
      ],
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    relatedGpsEventIds: [{
      type: Schema.Types.ObjectId,
      ref: "GpsEvent",
    }],
    detectedAt: {
      type: Date,
      required: true,
    },
    modelVersion: {
      type: String,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "false_positive", "actioned"],
      default: "new",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNotes: {
      type: String,
      maxlength: 2000,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "bus_anomalies",
  }
);

BusAnomalySchema.index({ busId: 1, detectedAt: 1 });
BusAnomalySchema.index({ schoolId: 1, status: 1 });
BusAnomalySchema.index({ severity: 1, status: 1 });

const BusAnomaly: Model<IBusAnomalyDocument> =
  mongoose.models.BusAnomaly ||
  mongoose.model<IBusAnomalyDocument>("BusAnomaly", BusAnomalySchema);

export default BusAnomaly;
'''

# 29. AiPrediction
models["AiPrediction.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiPrediction } from "@/types/ai";

export interface IAiPredictionDocument extends Omit<IAiPrediction, "_id">, Document {}

const AiPredictionSchema = new Schema<IAiPredictionDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    predictionType: {
      type: String,
      default: "performance",
      immutable: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    period: {
      type: String,
      maxlength: 50,
    },
    predictedGradeBand: {
      type: String,
      maxlength: 10,
    },
    predictedScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    inputFeatures: {
      attendanceRate: { type: Number },
      homeworkCompletionRate: { type: Number },
      avgPreviousScore: { type: Number },
      engagementScore: { type: Number },
    },
    modelName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelVersion: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: "ModelVersion",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "error"],
      default: "pending",
    },
    reviewStatus: {
      type: String,
      enum: ["unreviewed", "accepted", "noted", "rejected"],
      default: "unreviewed",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "ai_predictions",
  }
);

AiPredictionSchema.index({ studentId: 1, createdAt: 1 });
AiPredictionSchema.index({ studentId: 1, subjectId: 1, academicYear: 1 });
AiPredictionSchema.index({ schoolId: 1, createdAt: 1 });

const AiPrediction: Model<IAiPredictionDocument> =
  mongoose.models.AiPrediction ||
  mongoose.model<IAiPredictionDocument>("AiPrediction", AiPredictionSchema);

export default AiPrediction;
'''

# 30. RiskScore
models["RiskScore.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IRiskScore } from "@/types/ai";

export interface IRiskScoreDocument extends Omit<IRiskScore, "_id">, Document {}

const RiskScoreSchema = new Schema<IRiskScoreDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    riskCategory: {
      type: String,
      required: true,
      enum: ["low", "medium", "high"],
    },
    contributingFactors: [{
      factor: { type: String, required: true },
      weight: { type: Number, required: true },
      value: { type: Schema.Types.Mixed },
      description: { type: String, required: true },
    }],
    modelName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelVersion: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: "ModelVersion",
    },
    assessmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "superseded"],
      default: "active",
    },
    requiresCounselorReview: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    counselorNotes: {
      type: String,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "risk_scores",
  }
);

RiskScoreSchema.index({ studentId: 1, assessmentDate: 1 });
RiskScoreSchema.index({ riskCategory: 1, requiresCounselorReview: 1 });
RiskScoreSchema.index({ schoolId: 1, createdAt: 1 });

const RiskScore: Model<IRiskScoreDocument> =
  mongoose.models.RiskScore ||
  mongoose.model<IRiskScoreDocument>("RiskScore", RiskScoreSchema);

export default RiskScore;
'''

# 31. ModelVersion
models["ModelVersion.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IModelVersion } from "@/types/ai";

export interface IModelVersionDocument extends Omit<IModelVersion, "_id">, Document {}

const ModelVersionSchema = new Schema<IModelVersionDocument>(
  {
    modelName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelType: {
      type: String,
      required: true,
      enum: [
        "performance_prediction",
        "risk_prediction",
        "wellbeing_nlp",
        "study_recommendation",
        "bus_anomaly",
        "safety_hotspot",
      ],
    },
    version: {
      type: String,
      required: true,
      maxlength: 100,
    },
    trainingDate: {
      type: Date,
    },
    datasetDescription: {
      type: String,
      maxlength: 1000,
    },
    metrics: {
      accuracy: { type: Number },
      precision: { type: Number },
      recall: { type: Number },
      f1Score: { type: Number },
      additionalMetrics: { type: Schema.Types.Mixed },
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    artifactPath: {
      type: String,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "model_versions",
  }
);

ModelVersionSchema.index({ modelName: 1, version: 1 }, { unique: true });

const ModelVersion: Model<IModelVersionDocument> =
  mongoose.models.ModelVersion ||
  mongoose.model<IModelVersionDocument>("ModelVersion", ModelVersionSchema);

export default ModelVersion;
'''

# 32. AuditLog (Immutable)
models["AuditLog.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAuditLog } from "@/types/operations";

export interface IAuditLogDocument extends Omit<IAuditLog, "_id">, Document {}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    userRole: {
      type: String,
      maxlength: 50,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "EXPORT",
        "AI_PREDICTION",
        "ALERT",
      ],
    },
    resourceType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
    },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    ipAddress: {
      type: String,
      maxlength: 100,
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false, // Timestamp field is the event time
    collection: "audit_logs",
  }
);

AuditLogSchema.index({ schoolId: 1, timestamp: 1 });
AuditLogSchema.index({ userId: 1, timestamp: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: 1 });

// Reject updates and deletes to maintain immutability
AuditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"], function(next) {
  next(new Error("Audit logs are strictly immutable."));
});

const AuditLog: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLogDocument>("AuditLog", AuditLogSchema);

export default AuditLog;
'''

# Supporting Models (Driver, StudentBusAssignment, Notice, Message, Notification, EmergencyAlert, VisitorRecord, GatePass, StudyRecommendation, AiSummary, AiInteraction, BehaviorObservation, StudentEngagement)

models["Driver.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IDriver } from "@/types/transport";

export interface IDriverDocument extends Omit<IDriver, "_id">, Document {}

const DriverSchema = new Schema<IDriverDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: true,
      maxlength: 30,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "drivers",
  }
);

DriverSchema.index({ schoolId: 1 });

const Driver: Model<IDriverDocument> =
  mongoose.models.Driver || mongoose.model<IDriverDocument>("Driver", DriverSchema);

export default Driver;
'''

models["StudentBusAssignment.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudentBusAssignment } from "@/types/transport";

export interface IStudentBusAssignmentDocument
  extends Omit<IStudentBusAssignment, "_id">,
    Document {}

const StudentBusAssignmentSchema = new Schema<IStudentBusAssignmentDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    busRouteId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true,
    },
    stopName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    pickupTime: {
      type: String,
      maxlength: 10,
    },
    dropTime: {
      type: String,
      maxlength: 10,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "student_bus_assignments",
  }
);

StudentBusAssignmentSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
StudentBusAssignmentSchema.index({ busRouteId: 1 });
StudentBusAssignmentSchema.index({ schoolId: 1 });

const StudentBusAssignment: Model<IStudentBusAssignmentDocument> =
  mongoose.models.StudentBusAssignment ||
  mongoose.model<IStudentBusAssignmentDocument>(
    "StudentBusAssignment",
    StudentBusAssignmentSchema
  );

export default StudentBusAssignment;
'''

models["Notice.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { INotice } from "@/types/operations";

export interface INoticeDocument extends Omit<INotice, "_id">, Document {}

const NoticeSchema = new Schema<INoticeDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    targetRoles: [{
      type: String,
      enum: ["student", "parent", "teacher", "counselor", "admin"],
    }],
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    attachments: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    collection: "notices",
  }
);

NoticeSchema.index({ schoolId: 1, isPublished: 1, publishedAt: -1 });

const Notice: Model<INoticeDocument> =
  mongoose.models.Notice || mongoose.model<INoticeDocument>("Notice", NoticeSchema);

export default Notice;
'''

models["Message.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IMessage } from "@/types/operations";

export interface IMessageDocument extends Omit<IMessage, "_id">, Document {}

const MessageSchema = new Schema<IMessageDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    attachments: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    collection: "messages",
  }
);

MessageSchema.index({ recipientId: 1, isRead: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

const Message: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>("Message", MessageSchema);

export default Message;
'''

models["Notification.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { INotification } from "@/types/operations";

export interface INotificationDocument extends Omit<INotification, "_id">, Document {}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: ["academic", "attendance", "safety", "emergency", "system"],
      default: "system",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    linkUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>("Notification", NotificationSchema);

export default Notification;
'''

models["EmergencyAlert.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IEmergencyAlert } from "@/types/operations";

export interface IEmergencyAlertDocument extends Omit<IEmergencyAlert, "_id">, Document {}

const EmergencyAlertSchema = new Schema<IEmergencyAlertDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "resolved", "drill"],
      default: "active",
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "emergency_alerts",
  }
);

EmergencyAlertSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

const EmergencyAlert: Model<IEmergencyAlertDocument> =
  mongoose.models.EmergencyAlert ||
  mongoose.model<IEmergencyAlertDocument>("EmergencyAlert", EmergencyAlertSchema);

export default EmergencyAlert;
'''

models["VisitorRecord.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IVisitorRecord } from "@/types/operations";

export interface IVisitorRecordDocument extends Omit<IVisitorRecord, "_id">, Document {}

const VisitorRecordSchema = new Schema<IVisitorRecordDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    visitorName: {
      type: String,
      required: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      maxlength: 30,
    },
    purpose: {
      type: String,
      required: true,
      maxlength: 500,
    },
    personToMeet: {
      type: String,
      maxlength: 150,
    },
    idProofType: {
      type: String,
      maxlength: 50,
    },
    idProofNumber: {
      type: String,
      maxlength: 100,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutTime: {
      type: Date,
    },
    badgeNumber: {
      type: String,
      maxlength: 50,
    },
    gatePassedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "visitor_records",
  }
);

VisitorRecordSchema.index({ schoolId: 1, checkInTime: -1 });

const VisitorRecord: Model<IVisitorRecordDocument> =
  mongoose.models.VisitorRecord ||
  mongoose.model<IVisitorRecordDocument>("VisitorRecord", VisitorRecordSchema);

export default VisitorRecord;
'''

models["GatePass.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IGatePass } from "@/types/operations";

export interface IGatePassDocument extends Omit<IGatePass, "_id">, Document {}

const GatePassSchema = new Schema<IGatePassDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    destination: {
      type: String,
      maxlength: 200,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "used", "expired"],
      default: "pending",
    },
    qrCodeData: {
      type: String,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    usedAt: {
      type: Date,
    },
    verifiedByGateStaff: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "gate_passes",
  }
);

GatePassSchema.index({ schoolId: 1, status: 1 });
GatePassSchema.index({ studentId: 1, validFrom: -1 });

const GatePass: Model<IGatePassDocument> =
  mongoose.models.GatePass ||
  mongoose.model<IGatePassDocument>("GatePass", GatePassSchema);

export default GatePass;
'''

models["BehaviorObservation.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IBehaviorObservation } from "@/types/operations";

export interface IBehaviorObservationDocument
  extends Omit<IBehaviorObservation, "_id">,
    Document {}

const BehaviorObservationSchema = new Schema<IBehaviorObservationDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    observationDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ["positive", "concern", "neutral"],
      required: true,
    },
    category: {
      type: String,
      enum: ["participation", "conduct", "peer_interaction", "focus", "other"],
      required: true,
    },
    notes: {
      type: String,
      required: true,
      maxlength: 3000,
    },
    actionTaken: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: "behavior_observations",
  }
);

BehaviorObservationSchema.index({ studentId: 1, observationDate: -1 });
BehaviorObservationSchema.index({ schoolId: 1, type: 1 });

const BehaviorObservation: Model<IBehaviorObservationDocument> =
  mongoose.models.BehaviorObservation ||
  mongoose.model<IBehaviorObservationDocument>(
    "BehaviorObservation",
    BehaviorObservationSchema
  );

export default BehaviorObservation;
'''

models["StudentEngagement.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudentEngagement } from "@/types/operations";

export interface IStudentEngagementDocument
  extends Omit<IStudentEngagement, "_id">,
    Document {}

const StudentEngagementSchema = new Schema<IStudentEngagementDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 53,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    engagementScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    attendanceComponent: {
      type: Number,
      min: 0,
      max: 100,
    },
    homeworkComponent: {
      type: Number,
      min: 0,
      max: 100,
    },
    participationComponent: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: "student_engagement",
  }
);

StudentEngagementSchema.index(
  { studentId: 1, subjectId: 1, academicYear: 1, weekNumber: 1 },
  { unique: true }
);

const StudentEngagement: Model<IStudentEngagementDocument> =
  mongoose.models.StudentEngagement ||
  mongoose.model<IStudentEngagementDocument>(
    "StudentEngagement",
    StudentEngagementSchema
  );

export default StudentEngagement;
'''

models["StudyRecommendation.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudyRecommendation } from "@/types/ai";

export interface IStudyRecommendationDocument
  extends Omit<IStudyRecommendation, "_id">,
    Document {}

const StudyRecommendationSchema = new Schema<IStudyRecommendationDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    weakTopics: [{
      type: String,
      maxlength: 100,
    }],
    recommendedMaterialIds: [{
      type: Schema.Types.ObjectId,
      ref: "StudyMaterial",
    }],
    scoreGap: {
      type: Number,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isViewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "study_recommendations",
  }
);

StudyRecommendationSchema.index({ studentId: 1, generatedAt: -1 });

const StudyRecommendation: Model<IStudyRecommendationDocument> =
  mongoose.models.StudyRecommendation ||
  mongoose.model<IStudyRecommendationDocument>(
    "StudyRecommendation",
    StudyRecommendationSchema
  );

export default StudyRecommendation;
'''

models["AiSummary.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiSummary } from "@/types/ai";

export interface IAiSummaryDocument extends Omit<IAiSummary, "_id">, Document {}

const AiSummarySchema = new Schema<IAiSummaryDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 53,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    attendanceSummary: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    academicSummary: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    wellbeingSummary: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    overallNarrative: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    actionableTips: [{
      type: String,
      maxlength: 500,
    }],
    status: {
      type: String,
      enum: ["draft", "reviewed", "published"],
      default: "draft",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "ai_summaries",
  }
);

AiSummarySchema.index(
  { studentId: 1, academicYear: 1, weekNumber: 1 },
  { unique: true }
);

const AiSummary: Model<IAiSummaryDocument> =
  mongoose.models.AiSummary ||
  mongoose.model<IAiSummaryDocument>("AiSummary", AiSummarySchema);

export default AiSummary;
'''

models["AiInteraction.ts"] = '''import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiInteraction } from "@/types/ai";

export interface IAiInteractionDocument extends Omit<IAiInteraction, "_id">, Document {}

const AiInteractionSchema = new Schema<IAiInteractionDocument>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      required: true,
      maxlength: 50,
    },
    sessionType: {
      type: String,
      enum: ["study_assistant", "parent_assistant"],
      required: true,
    },
    query: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    response: {
      type: String,
      required: true,
      maxlength: 15000,
    },
    retrievedChunkIds: [{
      type: String,
    }],
    citedSources: [{
      type: String,
    }],
    tokensUsed: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "ai_interactions",
  }
);

AiInteractionSchema.index({ userId: 1, timestamp: -1 });
AiInteractionSchema.index({ schoolId: 1, sessionType: 1 });

const AiInteraction: Model<IAiInteractionDocument> =
  mongoose.models.AiInteraction ||
  mongoose.model<IAiInteractionDocument>("AiInteraction", AiInteractionSchema);

export default AiInteraction;
'''

# Index.ts
index_lines = []
for filename in sorted(models.keys()):
    mod_name = filename[:-3]
    if mod_name == "Class":
        index_lines.append(f'export {{ default as Class }} from "./Class";')
        index_lines.append(f'export * from "./Class";')
    else:
        index_lines.append(f'export {{ default as {mod_name} }} from "./{mod_name}";')
        index_lines.append(f'export * from "./{mod_name}";')

models["index.ts"] = "\\n".join(index_lines) + "\\n"

# Write files
for filename, content in models.items():
    file_path = os.path.join(MODELS_DIR, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {file_path}")

print(f"\\nSuccessfully generated {len(models)} Mongoose model files!")
