import mongoose, { Schema, Model, Document } from "mongoose";
import { ITeacher } from "@/types/identity";

export interface ITeacherDocument extends Omit<ITeacher, "_id">, Document {}

const TeacherSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    staffCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      maxlength: 30,
    },
    qualification: {
      type: String,
      maxlength: 200,
    },
    specializations: [{
      type: String,
      maxlength: 100,
    }],
    subjectSpecialization: {
      type: String,
      maxlength: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "teachers",
  }
);

TeacherSchema.index({ schoolId: 1 });
TeacherSchema.index({ schoolId: 1, staffCode: 1 }, { unique: true });

const Teacher: Model<ITeacherDocument> =
  mongoose.models.Teacher || mongoose.model<ITeacherDocument>("Teacher", TeacherSchema);

export default Teacher;
