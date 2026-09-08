import { SeverityLevel } from "./wellbeing";

export type SafetyReportType =
  | "bullying"
  | "physical_threat"
  | "unsafe_area"
  | "self_harm_concern"
  | "other";

export type SafetyReportStatus =
  | "new"
  | "under_review"
  | "resolved"
  | "closed";

export type SafetyIncidentType =
  | "bullying"
  | "physical_altercation"
  | "theft"
  | "vandalism"
  | "threat"
  | "medical"
  | "other";

export type SafetyIncidentStatus =
  | "open"
  | "investigating"
  | "resolved";

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ISafetyReport {
  _id?: string;
  schoolId: string;
  reporterStudentId?: string;
  isAnonymous: boolean;
  reportType: SafetyReportType;
  description: string;
  locationDescription?: string;
  involvedParties?: string[];
  attachmentUrls?: string[];
  status: SafetyReportStatus;
  assignedTo?: string;
  nlpAnalyzed: boolean;
  nlpSignals?: {
    signalType?: string;
    confidence?: number;
    severity?: string;
    modelVersion?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISafetyIncident {
  _id?: string;
  schoolId: string;
  title: string;
  incidentType: SafetyIncidentType;
  description: string;
  location: {
    description?: string;
    coordinates?: IGeoPoint;
  };
  incidentDate: Date;
  involvedStudentIds?: string[];
  involvedStaffIds?: string[];
  reportedBy?: string;
  status: SafetyIncidentStatus;
  resolution?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISafetyHotspot {
  _id?: string;
  schoolId: string;
  centroid: IGeoPoint;
  radiusMeters: number;
  incidentCount: number;
  incidentIds?: string[];
  periodStart: Date;
  periodEnd: Date;
  severity: SeverityLevel;
  modelVersion: string;
  generatedAt: Date;
  isActive: boolean;
  createdAt?: Date;
}
