import mongoose, { Schema, Model, Document } from "mongoose";
import { IWellbeingSignal } from "@/types/wellbeing";

export interface IWellbeingSignalDocument
  extends Omit<IWellbeingSignal, "_id">,
    Document {}

const WellbeingSignalSchema = new Schema(
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
