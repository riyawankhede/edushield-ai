import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudyMaterial } from "@/types/academic";

export interface IStudyMaterialDocument
  extends Omit<IStudyMaterial, "_id">,
    Document {}

const StudyMaterialSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    grade: {
      type: String,
      required: true,
      maxlength: 20,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      maxlength: 3000,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "video", "slide", "link", "image", "document"],
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [{
      type: String,
      maxlength: 50,
    }],
    isPublished: {
      type: Boolean,
      default: false,
    },
    embedding: {
      type: [Number],
      select: false, // Vector embedding excluded by default for performance
    },
    embeddingModel: {
      type: String,
      maxlength: 100,
    },
    embeddingGeneratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "study_materials",
  }
);

StudyMaterialSchema.index({ subjectId: 1, grade: 1 });
StudyMaterialSchema.index({ schoolId: 1, isPublished: 1 });

const StudyMaterial: Model<IStudyMaterialDocument> =
  mongoose.models.StudyMaterial ||
  mongoose.model<IStudyMaterialDocument>("StudyMaterial", StudyMaterialSchema);

export default StudyMaterial;
