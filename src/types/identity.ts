export type UserRole = "student" | "parent" | "teacher" | "counselor" | "admin";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type RelationshipType = "mother" | "father" | "guardian" | "other";

export interface IUser {
  _id?: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  schoolId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface IStudent {
  _id?: string;
  userId: string;
  schoolId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender?: Gender;
  grade: string;
  section: string;
  classId?: string;
  enrollmentDate: Date;
  isActive: boolean;
  emergencyContact?: IEmergencyContact;
  address?: IAddress;
  profileImageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IParent {
  _id?: string;
  userId: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  occupation?: string;
  preferredLanguage: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IParentStudentRelationship {
  _id?: string;
  parentId: string;
  studentId: string;
  schoolId: string;
  relationship: RelationshipType;
  isPrimary: boolean;
  canReceiveAlerts: boolean;
  canReceiveReports: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITeacher {
  _id?: string;
  userId: string;
  schoolId: string;
  staffCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  qualification?: string;
  specializations: string[];
  subjectSpecialization?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICounselor {
  _id?: string;
  userId: string;
  schoolId: string;
  staffCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  qualification?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAdmin {
  _id?: string;
  userId: string;
  schoolId: string;
  staffCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  adminLevel: "school" | "super";
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITeacherClassAssignment {
  _id?: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYear: string;
  isActive: boolean;
  schoolId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
