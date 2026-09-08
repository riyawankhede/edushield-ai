import mongoose, { Schema, Model, Document } from "mongoose";
import { IClass } from "@/types/academic";

export interface IClassDocument extends Omit<IClass, "_id">, Document {}

const ClassSchema = new Schema(
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
      maxlength: 100,
    },
    grade: {
      type: String,
      required: true,
      maxlength: 20,
    },
    section: {
      type: String,
      required: true,
      maxlength: 10,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    roomNumber: {
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
    collection: "classes",
  }
);

ClassSchema.index(
  { schoolId: 1, grade: 1, section: 1, academicYear: 1 },
  { unique: true }
);

const ClassModel: Model<IClassDocument> =
  mongoose.models.Class || mongoose.model<IClassDocument>("Class", ClassSchema);

export default ClassModel;
