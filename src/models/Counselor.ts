import mongoose, { Schema, Model, Document } from "mongoose";
import { ICounselor } from "@/types/identity";

export interface ICounselorDocument extends Omit<ICounselor, "_id">, Document {}

const CounselorSchema = new Schema(
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
    qualification: {
      type: String,
      maxlength: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "counselors",
  }
);

CounselorSchema.index({ schoolId: 1 });

const Counselor: Model<ICounselorDocument> =
  mongoose.models.Counselor ||
  mongoose.model<ICounselorDocument>("Counselor", CounselorSchema);

export default Counselor;
