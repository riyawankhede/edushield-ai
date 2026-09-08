import mongoose, { Schema, Model, Document } from "mongoose";
import { ISafetyIncident } from "@/types/safety";

export interface ISafetyIncidentDocument
  extends Omit<ISafetyIncident, "_id">,
    Document {}

const SafetyIncidentSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    incidentType: {
      type: String,
      required: true,
      enum: [
        "bullying",
        "physical_altercation",
        "theft",
        "vandalism",
        "threat",
        "medical",
        "other",
      ],
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    location: {
      description: { type: String, maxlength: 300 },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          required: false,
        },
      },
    },
    incidentDate: {
      type: Date,
      required: true,
    },
    involvedStudentIds: [{
      type: Schema.Types.ObjectId,
      ref: "Student",
    }],
    involvedStaffIds: [{
      type: Schema.Types.ObjectId,
      ref: "User",
    }],
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved"],
      default: "open",
    },
    resolution: {
      type: String,
      maxlength: 3000,
    },
  },
  {
    timestamps: true,
    collection: "safety_incidents",
  }
);

SafetyIncidentSchema.index({ schoolId: 1, incidentDate: 1 });
SafetyIncidentSchema.index({ "location.coordinates": "2dsphere" });

const SafetyIncident: Model<ISafetyIncidentDocument> =
  mongoose.models.SafetyIncident ||
  mongoose.model<ISafetyIncidentDocument>("SafetyIncident", SafetyIncidentSchema);

export default SafetyIncident;
