import mongoose, { Schema, Model, Document } from "mongoose";
import { IGatePass } from "@/types/operations";

export interface IGatePassDocument extends Omit<IGatePass, "_id">, Document {}

const GatePassSchema = new Schema(
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
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    destination: {
      type: String,
      maxlength: 200,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "used", "expired"],
      default: "pending",
    },
    qrCodeData: {
      type: String,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    usedAt: {
      type: Date,
    },
    verifiedByGateStaff: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "gate_passes",
  }
);

GatePassSchema.index({ schoolId: 1, status: 1 });
GatePassSchema.index({ studentId: 1, validFrom: -1 });

const GatePass: Model<IGatePassDocument> =
  mongoose.models.GatePass ||
  mongoose.model<IGatePassDocument>("GatePass", GatePassSchema);

export default GatePass;
