import mongoose, { Schema, Model, Document } from "mongoose";
import { INotification } from "@/types/operations";

export interface INotificationDocument extends Omit<INotification, "_id">, Document {}

const NotificationSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: ["academic", "attendance", "safety", "emergency", "system"],
      default: "system",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    linkUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>("Notification", NotificationSchema);

export default Notification;
