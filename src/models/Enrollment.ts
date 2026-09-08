import mongoose, { Schema, Model, Document } from "mongoose";
import { IEnrollment } from "@/types/academic";

export interface IEnrollmentDocument extends Omit<IEnrollment, "_id">, Document {}

const EnrollmentSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "enrollments",
  }
);

EnrollmentSchema.index({ studentId: 1, classId: 1, academicYear: 1 }, { unique: true });
EnrollmentSchema.index({ studentId: 1, academicYear: 1 });
EnrollmentSchema.index({ classId: 1, academicYear: 1 });

const Enrollment: Model<IEnrollmentDocument> =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollmentDocument>("Enrollment", EnrollmentSchema);

export default Enrollment;
