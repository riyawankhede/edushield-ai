import mongoose, { Schema, Model, Document } from "mongoose";
import { IBehaviorObservation } from "@/types/operations";

export interface IBehaviorObservationDocument
  extends Omit<IBehaviorObservation, "_id">,
    Document {}

const BehaviorObservationSchema = new Schema(
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    observationDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ["positive", "concern", "neutral"],
      required: true,
    },
    category: {
      type: String,
      enum: ["participation", "conduct", "peer_interaction", "focus", "other"],
      required: true,
    },
    notes: {
      type: String,
      required: true,
      maxlength: 3000,
    },
    actionTaken: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: "behavior_observations",
  }
);

BehaviorObservationSchema.index({ studentId: 1, observationDate: -1 });
BehaviorObservationSchema.index({ schoolId: 1, type: 1 });

const BehaviorObservation: Model<IBehaviorObservationDocument> =
  mongoose.models.BehaviorObservation ||
  mongoose.model<IBehaviorObservationDocument>(
    "BehaviorObservation",
    BehaviorObservationSchema
  );

export default BehaviorObservation;
