export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "AI_PREDICTION"
  | "ALERT";

export type EmergencyAlertStatus = "active" | "resolved" | "drill";

export interface ISchool {
  _id?: string;
  name: string;
  code: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  academicYearCurrent: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAuditLog {
  _id?: string;
  schoolId?: string;
  userId?: string;
  userRole?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface IEmergencyAlert {
  _id?: string;
  schoolId: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  status: EmergencyAlertStatus;
  issuedBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVisitorRecord {
  _id?: string;
  schoolId: string;
  visitorName: string;
  phone: string;
  purpose: string;
  personToMeet?: string;
  idProofType?: string;
  idProofNumber?: string;
  checkInTime: Date;
  checkOutTime?: Date;
  badgeNumber?: string;
  gatePassedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGatePass {
  _id?: string;
  schoolId: string;
  studentId: string;
  requestedBy: string;
  reason: string;
  destination?: string;
  validFrom: Date;
  validTo: Date;
  status: "pending" | "approved" | "rejected" | "used" | "expired";
  qrCodeData?: string;
  approvedBy?: string;
  approvedAt?: Date;
  usedAt?: Date;
  verifiedByGateStaff?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotice {
  _id?: string;
  schoolId: string;
  title: string;
  content: string;
  targetRoles: string[]; // ['student', 'parent', 'teacher']
  priority: "low" | "normal" | "high";
  publishedBy: string;
  isPublished: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  attachments?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMessage {
  _id?: string;
  schoolId: string;
  senderId: string;
  recipientId: string;
  subject?: string;
  body: string;
  isRead: boolean;
  readAt?: Date;
  attachments?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotification {
  _id?: string;
  schoolId: string;
  userId: string;
  title: string;
  body: string;
  type: "academic" | "attendance" | "safety" | "emergency" | "system";
  isRead: boolean;
  linkUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBehaviorObservation {
  _id?: string;
  schoolId: string;
  studentId: string;
  teacherId: string;
  observationDate: Date;
  type: "positive" | "concern" | "neutral";
  category: "participation" | "conduct" | "peer_interaction" | "focus" | "other";
  notes: string;
  actionTaken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStudentEngagement {
  _id?: string;
  schoolId: string;
  studentId: string;
  subjectId: string;
  weekNumber: number;
  academicYear: string;
  engagementScore: number; // 0-100
  attendanceComponent: number;
  homeworkComponent: number;
  participationComponent: number;
  createdAt?: Date;
  updatedAt?: Date;
}
