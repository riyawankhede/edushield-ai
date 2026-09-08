import mongoose, { Schema, Model, Document } from "mongoose";
import { IGpsEvent } from "@/types/transport";

export interface IGpsEventDocument extends Omit<IGpsEvent, "_id">, Document {}

const GpsEventSchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      maxlength: 100,
    },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    speed: {
      type: Number,
      min: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    altitude: {
      type: Number,
    },
    accuracy: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    eventType: {
      type: String,
      enum: ["location", "stop", "ignition_on", "ignition_off", "panic", "geofence"],
      default: "location",
    },
  },
  {
    timestamps: false, // Event-only high-frequency collection
    collection: "gps_events",
  }
);

GpsEventSchema.index({ busId: 1, timestamp: 1 });
GpsEventSchema.index({ deviceId: 1, timestamp: 1 });
GpsEventSchema.index({ coordinates: "2dsphere" });
// TTL Index: 90 days retention (7,776,000 seconds)
GpsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

const GpsEvent: Model<IGpsEventDocument> =
  mongoose.models.GpsEvent || mongoose.model<IGpsEventDocument>("GpsEvent", GpsEventSchema);

export default GpsEvent;
