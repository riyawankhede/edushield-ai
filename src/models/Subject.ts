import mongoose, { Schema, Model, Document } from "mongoose";
import { ISubject } from "@/types/academic";

export interface ISubjectDocument extends Omit<ISubject, "_id">, Document {}

const SubjectSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    gradeLevel: {
      type: String,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "subjects",
  }
);

SubjectSchema.index({ schoolId: 1, code: 1 }, { unique: true });

const Subject: Model<ISubjectDocument> =
  mongoose.models.Subject || mongoose.model<ISubjectDocument>("Subject", SubjectSchema);

export default Subject;
