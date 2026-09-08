import mongoose, { Schema, Model, Document } from "mongoose";
import { IModelVersion } from "@/types/ai";

export interface IModelVersionDocument extends Omit<IModelVersion, "_id">, Document {}

const ModelVersionSchema = new Schema(
  {
    modelName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    modelType: {
      type: String,
      required: true,
      enum: [
        "performance_prediction",
        "risk_prediction",
        "wellbeing_nlp",
        "study_recommendation",
        "bus_anomaly",
        "safety_hotspot",
      ],
    },
    version: {
      type: String,
      required: true,
      maxlength: 100,
    },
    trainingDate: {
      type: Date,
    },
    datasetDescription: {
      type: String,
      maxlength: 1000,
    },
    metrics: {
      accuracy: { type: Number },
      precision: { type: Number },
      recall: { type: Number },
      f1Score: { type: Number },
      additionalMetrics: { type: Schema.Types.Mixed },
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    artifactPath: {
      type: String,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: "model_versions",
  }
);

ModelVersionSchema.index({ modelName: 1, version: 1 }, { unique: true });

const ModelVersion: Model<IModelVersionDocument> =
  mongoose.models.ModelVersion ||
  mongoose.model<IModelVersionDocument>("ModelVersion", ModelVersionSchema);

export default ModelVersion;
