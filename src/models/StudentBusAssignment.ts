import mongoose, { Schema, Model, Document } from "mongoose";
import { IStudentBusAssignment } from "@/types/transport";

export interface IStudentBusAssignmentDocument
  extends Omit<IStudentBusAssignment, "_id">,
    Document {}

const StudentBusAssignmentSchema = new Schema(
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
    busRouteId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true,
    },
    stopName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    pickupTime: {
      type: String,
      maxlength: 10,
    },
    dropTime: {
      type: String,
      maxlength: 10,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "student_bus_assignments",
  }
);

StudentBusAssignmentSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
StudentBusAssignmentSchema.index({ busRouteId: 1 });
StudentBusAssignmentSchema.index({ schoolId: 1 });

const StudentBusAssignment: Model<IStudentBusAssignmentDocument> =
  mongoose.models.StudentBusAssignment ||
  mongoose.model<IStudentBusAssignmentDocument>(
    "StudentBusAssignment",
    StudentBusAssignmentSchema
  );

export default StudentBusAssignment;
