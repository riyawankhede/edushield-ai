import mongoose, { Schema, Model, Document } from "mongoose";
import { IBusAnomaly } from "@/types/transport";

export interface IBusAnomalyDocument extends Omit<IBusAnomaly, "_id">, Document {}

const BusAnomalySchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    busRouteId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
    },
    anomalyType: {
      type: String,
      required: true,
      enum: [
        "route_deviation",
        "unexpected_stop",
        "excessive_speed",
        "extended_idle",
        "panic_button",
        "geofence_violation",
      ],
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    relatedGpsEventIds: [{
      type: Schema.Types.ObjectId,
      ref: "GpsEvent",
    }],
    detectedAt: {
      type: Date,
      required: true,
    },
    modelVersion: {
      type: String,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "false_positive", "actioned"],
      default: "new",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNotes: {
      type: String,
      maxlength: 2000,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "bus_anomalies",
  }
);

BusAnomalySchema.index({ busId: 1, detectedAt: 1 });
BusAnomalySchema.index({ schoolId: 1, status: 1 });
BusAnomalySchema.index({ severity: 1, status: 1 });

const BusAnomaly: Model<IBusAnomalyDocument> =
  mongoose.models.BusAnomaly ||
  mongoose.model<IBusAnomalyDocument>("BusAnomaly", BusAnomalySchema);

export default BusAnomaly;
