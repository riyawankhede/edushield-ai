import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiSummary } from "@/types/ai";

export interface IAiSummaryDocument extends Omit<IAiSummary, "_id">, Document {}

const AiSummarySchema = new Schema(
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
