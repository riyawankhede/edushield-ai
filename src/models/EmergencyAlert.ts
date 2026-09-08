import mongoose, { Schema, Model, Document } from "mongoose";
import { IEmergencyAlert } from "@/types/operations";

export interface IEmergencyAlertDocument extends Omit<IEmergencyAlert, "_id">, Document {}

const EmergencyAlertSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "resolved", "drill"],
      default: "active",
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "emergency_alerts",
  }
);

EmergencyAlertSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

const EmergencyAlert: Model<IEmergencyAlertDocument> =
  mongoose.models.EmergencyAlert ||
  mongoose.model<IEmergencyAlertDocument>("EmergencyAlert", EmergencyAlertSchema);

export default EmergencyAlert;
