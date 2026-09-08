import mongoose, { Schema, Model, Document } from "mongoose";
import { IVisitorRecord } from "@/types/operations";

export interface IVisitorRecordDocument extends Omit<IVisitorRecord, "_id">, Document {}

const VisitorRecordSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    visitorName: {
      type: String,
      required: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      maxlength: 30,
    },
    purpose: {
      type: String,
      required: true,
      maxlength: 500,
    },
    personToMeet: {
      type: String,
      maxlength: 150,
    },
    idProofType: {
      type: String,
      maxlength: 50,
    },
    idProofNumber: {
      type: String,
      maxlength: 100,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutTime: {
      type: Date,
    },
    badgeNumber: {
      type: String,
      maxlength: 50,
    },
    gatePassedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "visitor_records",
  }
);

VisitorRecordSchema.index({ schoolId: 1, checkInTime: -1 });

const VisitorRecord: Model<IVisitorRecordDocument> =
  mongoose.models.VisitorRecord ||
  mongoose.model<IVisitorRecordDocument>("VisitorRecord", VisitorRecordSchema);

export default VisitorRecord;
