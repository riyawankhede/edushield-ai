import mongoose, { Schema, Model, Document } from "mongoose";
import { IHomeworkSubmission } from "@/types/academic";

export interface IHomeworkSubmissionDocument
  extends Omit<IHomeworkSubmission, "_id">,
    Document {}

const HomeworkSubmissionSchema = new Schema(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    content: {
      type: String,
      maxlength: 5000,
    },
    attachmentUrls: [{
      type: String,
    }],
    marksAwarded: {
      type: Number,
      min: 0,
    },
    feedback: {
      type: String,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["submitted", "late", "graded", "missing"],
      default: "missing",
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    gradedAt: {
      type: Date,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "homework_submissions",
  }
);

HomeworkSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
HomeworkSubmissionSchema.index({ assignmentId: 1 });
HomeworkSubmissionSchema.index({ studentId: 1, status: 1 });

const HomeworkSubmission: Model<IHomeworkSubmissionDocument> =
  mongoose.models.HomeworkSubmission ||
  mongoose.model<IHomeworkSubmissionDocument>(
    "HomeworkSubmission",
    HomeworkSubmissionSchema
  );

export default HomeworkSubmission;
