export type PredictionReviewStatus =
  | "unreviewed"
  | "accepted"
  | "noted"
  | "rejected";

export type RiskCategory = "low" | "medium" | "high";

export type ModelType =
  | "performance_prediction"
  | "risk_prediction"
  | "wellbeing_nlp"
  | "study_recommendation"
  | "bus_anomaly"
  | "safety_hotspot";

export interface IContributingFactor {
  factor: string;
  weight: number;
  value?: unknown;
  description: string;
}

export interface IAiPrediction {
  _id?: string;
  studentId: string;
  schoolId: string;
  predictionType: string;
  subjectId?: string;
  academicYear: string;
  period?: string;
  predictedGradeBand?: string;
  predictedScore?: number;
  confidence?: number;
  inputFeatures?: {
    attendanceRate?: number;
    homeworkCompletionRate?: number;
    avgPreviousScore?: number;
    engagementScore?: number;
  };
  modelName: string;
  modelVersion: string;
  modelId?: string;
  status: "pending" | "completed" | "error";
  reviewStatus: PredictionReviewStatus;
  reviewedBy?: string;
  createdAt?: Date;
}

export interface IRiskScore {
  _id?: string;
  studentId: string;
  schoolId: string;
  riskScore: number;
  riskCategory: RiskCategory;
  contributingFactors: IContributingFactor[];
  modelName: string;
  modelVersion: string;
  modelId?: string;
  assessmentDate: Date;
  status: "active" | "superseded";
  requiresCounselorReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  counselorNotes?: string;
  createdAt?: Date;
}

export interface IModelVersion {
  _id?: string;
  modelName: string;
  modelType: ModelType;
  version: string;
  trainingDate?: Date;
  datasetDescription?: string;
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    additionalMetrics?: Record<string, unknown>;
  };
  isActive: boolean;
  artifactPath?: string;
  createdAt?: Date;
}

export interface IStudyRecommendation {
  _id?: string;
  schoolId: string;
  studentId: string;
  subjectId: string;
  weakTopics: string[];
  recommendedMaterialIds: string[];
  scoreGap?: number;
  generatedAt: Date;
  isViewed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAiSummary {
  _id?: string;
  schoolId: string;
  studentId: string;
  weekNumber: number;
  academicYear: string;
  attendanceSummary: string;
  academicSummary: string;
  wellbeingSummary: string;
  overallNarrative: string;
  actionableTips: string[];
  status: "draft" | "reviewed" | "published";
  reviewedBy?: string;
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAiInteraction {
  _id?: string;
  schoolId: string;
  userId: string;
  userRole: string;
  sessionType: "study_assistant" | "parent_assistant";
  query: string;
  response: string;
  retrievedChunkIds?: string[];
  citedSources?: string[];
  tokensUsed?: number;
  timestamp: Date;
}
