import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyReport } from "@/types/safety";

export interface ISafetyReportDocument
  extends Omit<ISafetyReport, "_id">,
    Document {}

const SafetyReportSchema = new Schema(
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
