import mongoose, { Schema, Model, Document } from "mongoose";
import { IBusRoute } from "@/types/transport";

export interface IBusRouteDocument extends Omit<IBusRoute, "_id">, Document {}

const BusRouteSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    routeName: {
      type: String,
      required: true,
      maxlength: 200,
    },
    routeCode: {
      type: String,
      required: true,
      uppercase: true,
      maxlength: 50,
    },
    academicYear: {
      type: String,
      required: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stops: [{
      stopName: { type: String, required: true, maxlength: 200 },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true },
      },
      scheduledArrival: { type: String, maxlength: 10 },
      scheduledDeparture: { type: String, maxlength: 10 },
      order: { type: Number, required: true },
    }],
    estimatedDurationMinutes: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "bus_routes",
  }
);

BusRouteSchema.index({ schoolId: 1, routeCode: 1 }, { unique: true });
BusRouteSchema.index({ busId: 1 });

const BusRoute: Model<IBusRouteDocument> =
  mongoose.models.BusRoute || mongoose.model<IBusRouteDocument>("BusRoute", BusRouteSchema);

export default BusRoute;
