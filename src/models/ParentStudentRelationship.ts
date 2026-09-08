import mongoose, { Schema, Model, Document } from "mongoose";
import { IParentStudentRelationship } from "@/types/identity";

export interface IParentStudentRelationshipDocument
  extends Omit<IParentStudentRelationship, "_id">,
    Document {}

const ParentStudentRelationshipSchema = new Schema(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    relationship: {
      type: String,
      required: true,
      enum: ["mother", "father", "guardian", "other"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    canReceiveAlerts: {
      type: Boolean,
      default: true,
    },
    canReceiveReports: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "parent_student_relationships",
  }
);

ParentStudentRelationshipSchema.index({ parentId: 1, studentId: 1 }, { unique: true });
ParentStudentRelationshipSchema.index({ studentId: 1 });
ParentStudentRelationshipSchema.index({ schoolId: 1 });

const ParentStudentRelationship: Model<IParentStudentRelationshipDocument> =
  mongoose.models.ParentStudentRelationship ||
  mongoose.model<IParentStudentRelationshipDocument>(
    "ParentStudentRelationship",
    ParentStudentRelationshipSchema
  );

export default ParentStudentRelationship;
