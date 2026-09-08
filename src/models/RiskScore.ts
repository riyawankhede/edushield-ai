import mongoose, { Schema, Model, Document } from "mongoose";
import { IRiskScore } from "@/types/ai";

export interface IRiskScoreDocument extends Omit<IRiskScore, "_id">, Document {}

const RiskScoreSchema = new Schema(
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
