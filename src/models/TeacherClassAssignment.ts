import mongoose, { Schema, Model, Document } from "mongoose";
import { ITeacherClassAssignment } from "@/types/identity";

export interface ITeacherClassAssignmentDocument
  extends Omit<ITeacherClassAssignment, "_id">,
    Document {}

const TeacherClassAssignmentSchema = new Schema(
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
