import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudyRecommendation } from "@/types/ai";

export interface IStudyRecommendationDocument
  extends Omit<IStudyRecommendation, "_id">,
    Document {}

const StudyRecommendationSchema = new Schema(
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
    weakTopics: [{
      type: String,
      maxlength: 100,
    }],
    recommendedMaterialIds: [{
      type: Schema.Types.ObjectId,
      ref: "StudyMaterial",
    }],
    scoreGap: {
      type: Number,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isViewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "study_recommendations",
  }
);

StudyRecommendationSchema.index({ studentId: 1, generatedAt: -1 });

const StudyRecommendation: Model<IStudyRecommendationDocument> =
  mongoose.models.StudyRecommendation ||
  mongoose.model<IStudyRecommendationDocument>(
    "StudyRecommendation",
    StudyRecommendationSchema
  );

export default StudyRecommendation;
