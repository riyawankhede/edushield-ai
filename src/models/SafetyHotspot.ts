import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyHotspot } from "@/types/safety";

export interface ISafetyHotspotDocument
  extends Omit<ISafetyHotspot, "_id">,
    Document {}

const SafetyHotspotSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    centroid: {
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
    radiusMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    incidentCount: {
      type: Number,
      required: true,
      min: 1,
    },
    incidentIds: [{
      type: Schema.Types.ObjectId,
      ref: "SafetyIncident",
    }],
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    modelVersion: {
      type: String,
      required: true,
      maxlength: 100,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "safety_hotspots",
  }
);

SafetyHotspotSchema.index({ schoolId: 1, isActive: 1 });
SafetyHotspotSchema.index({ centroid: "2dsphere" });

const SafetyHotspot: Model<ISafetyHotspotDocument> =
  mongoose.models.SafetyHotspot ||
  mongoose.model<ISafetyHotspotDocument>("SafetyHotspot", SafetyHotspotSchema);

export default SafetyHotspot;
