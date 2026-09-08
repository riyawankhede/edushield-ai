import mongoose, { Schema, Model, Document } from "mongoose";
import { IAssignment } from "@/types/academic";

export interface IAssignmentDocument extends Omit<IAssignment, "_id">, Document {}

const AssignmentSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 3000,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    maxMarks: {
      type: Number,
      min: 0,
      default: 20,
    },
    attachments: [{
      type: String,
    }],
    type: {
      type: String,
      enum: ["homework", "project", "classwork", "reading"],
      default: "homework",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "assignments",
  }
);

AssignmentSchema.index({ classId: 1, dueDate: 1 });
AssignmentSchema.index({ teacherId: 1 });
AssignmentSchema.index({ schoolId: 1, createdAt: 1 });

const Assignment: Model<IAssignmentDocument> =
  mongoose.models.Assignment ||
  mongoose.model<IAssignmentDocument>("Assignment", AssignmentSchema);

export default Assignment;
