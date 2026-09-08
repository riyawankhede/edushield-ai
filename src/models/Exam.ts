import mongoose, { Schema, Model, Document } from "mongoose";
import { IExam } from "@/types/academic";

export interface IExamDocument extends Omit<IExam, "_id">, Document {}

const ExamSchema = new Schema(
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
