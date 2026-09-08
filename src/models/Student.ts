import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudent } from "@/types/identity";

export interface IStudentDocument extends Omit<IStudent, "_id">, Document {}

const StudentSchema = new Schema(
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
    studentCode: {
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
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
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
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    enrollmentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emergencyContact: {
      name: { type: String, maxlength: 150 },
      phone: { type: String, maxlength: 30 },
      relationship: { type: String, maxlength: 50 },
    },
    address: {
      street: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      postalCode: { type: String, maxlength: 20 },
    },
    profileImageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "students",
  }
);

StudentSchema.index({ schoolId: 1, grade: 1, section: 1 });
StudentSchema.index({ schoolId: 1, studentCode: 1 }, { unique: true });

const Student: Model<IStudentDocument> =
  mongoose.models.Student || mongoose.model<IStudentDocument>("Student", StudentSchema);

export default Student;
