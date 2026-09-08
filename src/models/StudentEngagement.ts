import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudentEngagement } from "@/types/operations";

export interface IStudentEngagementDocument
  extends Omit<IStudentEngagement, "_id">,
    Document {}

const StudentEngagementSchema = new Schema(
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
