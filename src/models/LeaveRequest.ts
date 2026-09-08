import mongoose, { Schema, Model, Document } from "mongoose";
import { ILeaveRequest } from "@/types/attendance";

export interface ILeaveRequestDocument
  extends Omit<ILeaveRequest, "_id">,
    Document {}

const LeaveRequestSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewerRemarks: {
      type: String,
      maxlength: 1000,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "leave_requests",
  }
);

LeaveRequestSchema.index({ studentId: 1 });
LeaveRequestSchema.index({ schoolId: 1, status: 1 });
LeaveRequestSchema.index({ fromDate: 1 });

const LeaveRequest: Model<ILeaveRequestDocument> =
  mongoose.models.LeaveRequest ||
  mongoose.model<ILeaveRequestDocument>("LeaveRequest", LeaveRequestSchema);

export default LeaveRequest;
