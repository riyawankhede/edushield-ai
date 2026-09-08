import mongoose, { Schema, Model, Document } from "mongoose";
import { IMessage } from "@/types/operations";

export interface IMessageDocument extends Omit<IMessage, "_id">, Document {}

const MessageSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    attachments: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    collection: "messages",
  }
);

MessageSchema.index({ recipientId: 1, isRead: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

const Message: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>("Message", MessageSchema);

export default Message;
