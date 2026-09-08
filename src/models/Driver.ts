import mongoose, { Schema, Model, Document } from "mongoose";
import { IDriver } from "@/types/transport";

export interface IDriverDocument extends Omit<IDriver, "_id">, Document {}

const DriverSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: true,
      maxlength: 30,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "drivers",
  }
);

DriverSchema.index({ schoolId: 1 });

const Driver: Model<IDriverDocument> =
  mongoose.models.Driver || mongoose.model<IDriverDocument>("Driver", DriverSchema);

export default Driver;
