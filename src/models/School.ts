import mongoose, { Schema, Model, Document } from "mongoose";
import { ISchool } from "@/types/operations";

export interface ISchoolDocument extends Omit<ISchool, "_id">, Document {}

const SchoolSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    address: {
      type: String,
      maxlength: 500,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
    },
    academicYearCurrent: {
      type: String,
      required: true,
      default: "2025-26",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "schools",
  }
);

const School: Model<ISchoolDocument> =
  mongoose.models.School || mongoose.model<ISchoolDocument>("School", SchoolSchema);

export default School;
