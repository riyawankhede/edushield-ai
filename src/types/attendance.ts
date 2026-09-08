export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface IAttendanceRecord {
  _id?: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  remarks?: string;
  recordedBy?: string;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILeaveRequest {
  _id?: string;
  studentId: string;
  requestedBy: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewerRemarks?: string;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
