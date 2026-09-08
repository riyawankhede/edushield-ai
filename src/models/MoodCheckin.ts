import mongoose, { Schema, Model, Document } from "mongoose";
import { IMoodCheckin } from "@/types/wellbeing";

export interface IMoodCheckinDocument
  extends Omit<IMoodCheckin, "_id">,
    Document {}

const MoodCheckinSchema = new Schema(
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
