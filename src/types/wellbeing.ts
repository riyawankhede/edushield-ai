export type MoodLabel = "great" | "good" | "okay" | "low" | "struggling";

export type WellbeingSignalType =
  | "distress"
  | "isolation"
  | "aggression"
  | "bullying_indicator"
  | "anxiety"
  | "positive";

export type SeverityLevel = "low" | "medium" | "high";

export interface IMoodCheckin {
  _id?: string;
  studentId: string;
  date: Date;
  moodScore: number;
  moodLabel: MoodLabel;
  notes?: string;
  isAnonymous: boolean;
  nlpAnalyzed: boolean;
  nlpAnalyzedAt?: Date;
  schoolId: string;
  createdAt?: Date;
}

export interface IWellbeingSignal {
  _id?: string;
  studentId: string;
  sourceCheckinId: string;
  signalType: WellbeingSignalType;
  confidence: number;
  severity: SeverityLevel;
  modelVersion: string;
  requiresCounselorReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  schoolId: string;
  createdAt?: Date;
}
