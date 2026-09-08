import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiPrediction } from "@/types/ai";

export interface IAiPredictionDocument extends Omit<IAiPrediction, "_id">, Document {}

const AiPredictionSchema = new Schema(
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
