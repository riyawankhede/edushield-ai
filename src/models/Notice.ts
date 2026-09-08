import mongoose, { Schema, Model, Document } from "mongoose";
import { INotice } from "@/types/operations";

export interface INoticeDocument extends Omit<INotice, "_id">, Document {}

const NoticeSchema = new Schema(
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
      maxlength: 255,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    targetRoles: [{
      type: String,
      enum: ["student", "parent", "teacher", "counselor", "admin"],
    }],
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    attachments: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    collection: "notices",
  }
);

NoticeSchema.index({ schoolId: 1, isPublished: 1, publishedAt: -1 });

const Notice: Model<INoticeDocument> =
  mongoose.models.Notice || mongoose.model<INoticeDocument>("Notice", NoticeSchema);

export default Notice;
