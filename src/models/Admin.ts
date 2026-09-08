import mongoose, { Schema, Model, Document } from "mongoose";
import { IAdmin } from "@/types/identity";

export interface IAdminDocument extends Omit<IAdmin, "_id">, Document {}

const AdminSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    staffCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
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
      maxlength: 30,
    },
    adminLevel: {
      type: String,
      enum: ["school", "super"],
      default: "school",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

AdminSchema.index({ schoolId: 1 });

const Admin: Model<IAdminDocument> =
  mongoose.models.Admin || mongoose.model<IAdminDocument>("Admin", AdminSchema);

export default Admin;
