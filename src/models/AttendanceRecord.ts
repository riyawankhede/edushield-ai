import mongoose, { Schema, Model, Document } from "mongoose";
import { IAttendanceRecord } from "@/types/attendance";

export interface IAttendanceRecordDocument
  extends Omit<IAttendanceRecord, "_id">,
    Document {}

const AttendanceRecordSchema = new Schema(
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
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["present", "absent", "late", "excused"],
    },
    remarks: {
      type: String,
      maxlength: 500,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "attendance_records",
  }
);

AttendanceRecordSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });
AttendanceRecordSchema.index({ classId: 1, date: 1 });
AttendanceRecordSchema.index({ studentId: 1, schoolId: 1, date: 1 });

const AttendanceRecord: Model<IAttendanceRecordDocument> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecordDocument>("AttendanceRecord", AttendanceRecordSchema);

export default AttendanceRecord;
