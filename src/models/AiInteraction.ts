import mongoose, { Schema, Model, Document } from "mongoose";
import { IAiInteraction } from "@/types/ai";

export interface IAiInteractionDocument extends Omit<IAiInteraction, "_id">, Document {}

const AiInteractionSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      required: true,
      maxlength: 50,
    },
    sessionType: {
      type: String,
      enum: ["study_assistant", "parent_assistant"],
      required: true,
    },
    query: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    response: {
      type: String,
      required: true,
      maxlength: 15000,
    },
    retrievedChunkIds: [{
      type: String,
    }],
    citedSources: [{
      type: String,
    }],
    tokensUsed: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "ai_interactions",
  }
);

AiInteractionSchema.index({ userId: 1, timestamp: -1 });
AiInteractionSchema.index({ schoolId: 1, sessionType: 1 });

const AiInteraction: Model<IAiInteractionDocument> =
  mongoose.models.AiInteraction ||
  mongoose.model<IAiInteractionDocument>("AiInteraction", AiInteractionSchema);

export default AiInteraction;
