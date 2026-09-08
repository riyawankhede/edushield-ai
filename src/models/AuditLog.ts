import mongoose, { Schema, Model, Document } from "mongoose";
import { IAuditLog } from "@/types/operations";

export interface IAuditLogDocument extends Omit<IAuditLog, "_id">, Document {}

const AuditLogSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    userRole: {
      type: String,
      maxlength: 50,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "EXPORT",
        "AI_PREDICTION",
        "ALERT",
      ],
    },
    resourceType: {
      type: String,
      required: true,
      maxlength: 100,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
    },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    ipAddress: {
      type: String,
      maxlength: 100,
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false, // Timestamp field is the event time
    collection: "audit_logs",
  }
);

AuditLogSchema.index({ schoolId: 1, timestamp: 1 });
AuditLogSchema.index({ userId: 1, timestamp: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: 1 });

// Reject updates and deletes to maintain immutability
AuditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"], function(next) {
  next(new Error("Audit logs are strictly immutable."));
});

const AuditLog: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLogDocument>("AuditLog", AuditLogSchema);

export default AuditLog;
