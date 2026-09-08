export type ExamType =
  | "unit_test"
  | "mid_term"
  | "final"
  | "assignment"
  | "quiz"
  | "practical";

export type AssignmentType =
  | "homework"
  | "project"
  | "classwork"
  | "reading";

export type SubmissionStatus =
  | "submitted"
  | "late"
  | "graded"
  | "missing";

export type FileType =
  | "pdf"
  | "video"
  | "slide"
  | "link"
  | "image"
  | "document";

export interface IClass {
  _id?: string;
  schoolId: string;
  name: string;
  grade: string;
  section: string;
  academicYear: string;
  roomNumber?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubject {
  _id?: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string;
  gradeLevel?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEnrollment {
  _id?: string;
  studentId: string;
  classId: string;
  academicYear: string;
  enrollmentDate: Date;
  isActive: boolean;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IExam {
  _id?: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  name: string;
  type: ExamType;
  maxMarks: number;
  passingMarks: number;
  examDate: Date;
  academicYear: string;
  createdBy?: string;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IExamResult {
  _id?: string;
  studentId: string;
  examId: string;
  subjectId?: string;
  marksObtained: number;
  grade?: string;
  isPassed?: boolean;
  remarks?: string;
  enteredBy?: string;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAssignment {
  _id?: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description?: string;
  dueDate: Date;
  maxMarks?: number;
  attachments?: string[];
  type: AssignmentType;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IHomeworkSubmission {
  _id?: string;
  assignmentId: string;
  studentId: string;
  submittedAt?: Date;
  content?: string;
  attachmentUrls?: string[];
  marksAwarded?: number;
  feedback?: string;
  status: SubmissionStatus;
  gradedBy?: string;
  gradedAt?: Date;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStudyMaterial {
  _id?: string;
  schoolId: string;
  subjectId: string;
  grade: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: FileType;
  uploadedBy: string;
  tags?: string[];
  isPublished: boolean;
  embedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
