import mongoose, { Schema, Model, Document } from "mongoose";
import { IBus } from "@/types/transport";

export interface IBusDocument extends Omit<IBus, "_id">, Document {}

const BusSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    make: {
      type: String,
      maxlength: 100,
    },
    vehicleModel: {
      type: String,
      maxlength: 100,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentDriverId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 100,
    },
    routeCode: {
      type: String,
      maxlength: 50,
    },
  },
  {
    timestamps: true,
    collection: "buses",
  }
);

BusSchema.index({ schoolId: 1, isActive: 1 });

const Bus: Model<IBusDocument> =
  mongoose.models.Bus || mongoose.model<IBusDocument>("Bus", BusSchema);

export default Bus;
