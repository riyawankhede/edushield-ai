import mongoose, { Schema, Model, Document } from "mongoose";
import { IExamResult } from "@/types/academic";

export interface IExamResultDocument extends Omit<IExamResult, "_id">, Document {}

const ExamResultSchema = new Schema(
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
