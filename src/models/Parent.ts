import mongoose, { Schema, Model, Document } from "mongoose";
import { IParent } from "@/types/identity";

export interface IParentDocument extends Omit<IParent, "_id">, Document {}

const ParentSchema = new Schema(
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
    occupation: {
      type: String,
      maxlength: 100,
    },
    preferredLanguage: {
      type: String,
      default: "en",
      maxlength: 20,
    },
  },
  {
    timestamps: true,
    collection: "parents",
  }
);

ParentSchema.index({ schoolId: 1 });

const Parent: Model<IParentDocument> =
  mongoose.models.Parent || mongoose.model<IParentDocument>("Parent", ParentSchema);

export default Parent;
