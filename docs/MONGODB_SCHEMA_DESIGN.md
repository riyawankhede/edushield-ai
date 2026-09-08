# MongoDB Schema Design
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase — Mongoose Schema Specification

---

## Overview

This document provides Mongoose-compatible schema specifications for all collections. These are the canonical schema definitions to be implemented in the `/models` directory.

Each schema specifies:
- Field names and types
- Validation rules
- Default values
- Required fields
- Enum constraints
- Indexes
- Timestamps
- Relationships (refs)

---

## Naming Conventions

- Collection names: **plural snake_case** (e.g., `exam_results`)
- Field names: **camelCase** (e.g., `studentId`, `createdAt`)
- Mongoose model names: **PascalCase singular** (e.g., `ExamResult`)
- Ref strings: match the Mongoose model name exactly

---

## 1. Identity Domain

### User Schema

```typescript
// Model: User | Collection: users
{
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    required: true,
    enum: ['student', 'parent', 'teacher', 'counselor', 'admin']
  },
  schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  refreshTokenHash: { type: String, select: false },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: email (unique), { schoolId, role }
// Timestamps: true
// Select false on passwordHash and refreshTokenHash — never returned by default
```

### Student Schema

```typescript
// Model: Student | Collection: students
{
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  studentCode: { type: String, required: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  grade: { type: String, required: true },
  section: { type: String, required: true },
  enrollmentDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  emergencyContact: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relationship: { type: String, required: true }
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String
  },
  profileImageUrl: { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes:
//   { schoolId, grade, section }
//   { schoolId, studentCode } unique
//   userId unique
// Timestamps: true
```

### Parent Schema

```typescript
// Model: Parent | Collection: parents
{
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String },
  occupation: { type: String },
  preferredLanguage: { type: String, default: 'en' },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Timestamps: true
```

### ParentStudentRelationship Schema

```typescript
// Model: ParentStudentRelationship | Collection: parent_student_relationships
{
  parentId: { type: Schema.Types.ObjectId, ref: 'Parent', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  relationship: {
    type: String,
    required: true,
    enum: ['mother', 'father', 'guardian', 'other']
  },
  isPrimary: { type: Boolean, default: false },
  canReceiveAlerts: { type: Boolean, default: true },
  canReceiveReports: { type: Boolean, default: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes:
//   parentId
//   studentId
//   { parentId, studentId } unique
//   schoolId
// Timestamps: true
```

### Teacher Schema

```typescript
// Model: Teacher | Collection: teachers
{
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  staffCode: { type: String, required: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String },
  qualification: { type: String },
  specializations: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: userId unique, schoolId, { schoolId, staffCode } unique
// Timestamps: true
```

### TeacherClassAssignment Schema

```typescript
// Model: TeacherClassAssignment | Collection: teacher_class_assignments
{
  teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  academicYear: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: teacherId, { classId, subjectId }, { schoolId, academicYear }
// Unique: { teacherId, classId, subjectId, academicYear }
// Timestamps: true
```

---

## 2. Academic Domain

### Class Schema

```typescript
// Model: Class | Collection: classes
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true },
  grade: { type: String, required: true },
  section: { type: String, required: true },
  academicYear: { type: String, required: true },
  roomNumber: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { schoolId, grade, section, academicYear }
// Timestamps: true
```

### Subject Schema

```typescript
// Model: Subject | Collection: subjects
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  description: { type: String },
  gradeLevel: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { schoolId, code }
// Timestamps: true
```

### Enrollment Schema

```typescript
// Model: Enrollment | Collection: enrollments
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  enrollmentDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { studentId, classId, academicYear }
// Indexes: { studentId, academicYear }, { classId, academicYear }
// Timestamps: true
```

### Exam Schema

```typescript
// Model: Exam | Collection: exams
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['unit_test', 'mid_term', 'final', 'assignment', 'quiz', 'practical']
  },
  maxMarks: { type: Number, required: true, min: 1 },
  passingMarks: { type: Number, required: true, min: 0 },
  examDate: { type: Date, required: true },
  academicYear: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: false },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { classId, subjectId, academicYear }, { schoolId, examDate }
// Timestamps: true
```

### ExamResult Schema

```typescript
// Model: ExamResult | Collection: exam_results
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  grade: { type: String },
  isPassed: { type: Boolean },
  remarks: { type: String },
  enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { studentId, examId }
// Indexes: examId, { studentId, schoolId }
// Timestamps: true
// Pre-save hook: compute isPassed based on exam.passingMarks
```

### Assignment Schema

```typescript
// Model: Assignment | Collection: assignments
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  dueDate: { type: Date, required: true },
  maxMarks: { type: Number },
  attachments: [{ type: String }],
  type: {
    type: String,
    enum: ['homework', 'project', 'classwork', 'reading'],
    default: 'homework'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { classId, dueDate }, teacherId, { schoolId, createdAt }
// Timestamps: true
```

### HomeworkSubmission Schema

```typescript
// Model: HomeworkSubmission | Collection: homework_submissions
{
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date },
  content: { type: String },
  attachmentUrls: [{ type: String }],
  marksAwarded: { type: Number },
  feedback: { type: String },
  status: {
    type: String,
    enum: ['submitted', 'late', 'graded', 'missing'],
    default: 'missing'
  },
  gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { assignmentId, studentId }
// Indexes: assignmentId, studentId, { studentId, status }
// Timestamps: true
```

### StudyMaterial Schema

```typescript
// Model: StudyMaterial | Collection: study_materials
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  grade: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  fileUrl: { type: String, required: true },
  fileType: {
    type: String,
    enum: ['pdf', 'video', 'slide', 'link', 'image', 'document'],
    required: true
  },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [{ type: String }],
  isPublished: { type: Boolean, default: false },
  // Vector embedding for RAG
  embedding: { type: [Number], select: false },
  embeddingModel: { type: String },
  embeddingGeneratedAt: { type: Date },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { subjectId, grade }, { schoolId, isPublished }
// Atlas Vector Search index on embedding field
// Timestamps: true
```

---

## 3. Attendance Domain

### AttendanceRecord Schema

```typescript
// Model: AttendanceRecord | Collection: attendance_records
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    required: true,
    enum: ['present', 'absent', 'late', 'excused']
  },
  remarks: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { studentId, classId, date }
// Indexes: { classId, date }, { studentId, schoolId, date }
// Timestamps: true
```

### LeaveRequest Schema

```typescript
// Model: LeaveRequest | Collection: leave_requests
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewerRemarks: { type: String },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: studentId, { schoolId, status }, fromDate
// Timestamps: true
```

---

## 4. Well-being Domain

### MoodCheckin Schema

```typescript
// Model: MoodCheckin | Collection: mood_checkins
// SENSITIVE: notes field restricted at API layer to counselors only
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  date: { type: Date, required: true },
  moodScore: { type: Number, required: true, min: 1, max: 5 },
  moodLabel: {
    type: String,
    required: true,
    enum: ['great', 'good', 'okay', 'low', 'struggling']
  },
  notes: { type: String, maxlength: 2000 },  // Sensitive — select: false in public queries
  isAnonymous: { type: Boolean, default: false },
  nlpAnalyzed: { type: Boolean, default: false },
  nlpAnalyzedAt: { type: Date },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date }
}
// Unique: { studentId, date }
// Indexes: { schoolId, date }, { nlpAnalyzed, createdAt }
// Timestamps: false (use createdAt only — check-ins should not be edited)
```

### WellbeingSignal Schema

```typescript
// Model: WellbeingSignal | Collection: wellbeing_signals
// RESTRICTED: counselors and admins only
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  sourceCheckinId: { type: Schema.Types.ObjectId, ref: 'MoodCheckin', required: true },
  signalType: {
    type: String,
    required: true,
    enum: ['distress', 'isolation', 'aggression', 'bullying_indicator', 'anxiety', 'positive']
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high']
  },
  modelVersion: { type: String, required: true },
  requiresCounselorReview: { type: Boolean, default: false },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNotes: { type: String },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date }
}
// Indexes: studentId, { requiresCounselorReview, severity }, { schoolId, createdAt }
// Timestamps: false
```

---

## 5. Safety Domain

### SafetyReport Schema

```typescript
// Model: SafetyReport | Collection: safety_reports
// SENSITIVE: reporterStudentId NEVER exposed when isAnonymous=true
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  reporterStudentId: { type: Schema.Types.ObjectId, ref: 'Student' },  // nullable
  isAnonymous: { type: Boolean, required: true, default: false },
  reportType: {
    type: String,
    required: true,
    enum: ['bullying', 'physical_threat', 'unsafe_area', 'self_harm_concern', 'other']
  },
  description: { type: String, required: true, maxlength: 5000 },
  locationDescription: { type: String },
  involvedParties: [{ type: String }],  // text descriptions only, not student IDs
  attachmentUrls: [{ type: String }],
  status: {
    type: String,
    enum: ['new', 'under_review', 'resolved', 'closed'],
    default: 'new'
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  nlpAnalyzed: { type: Boolean, default: false },
  nlpSignals: {
    signalType: String,
    confidence: Number,
    severity: String,
    modelVersion: String
  },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { schoolId, status }, assignedTo, { schoolId, createdAt }
// Timestamps: true
// CRITICAL: API layer must NEVER return reporterStudentId if isAnonymous=true
```

### SafetyIncident Schema

```typescript
// Model: SafetyIncident | Collection: safety_incidents
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  incidentType: {
    type: String,
    required: true,
    enum: ['bullying', 'physical_altercation', 'theft', 'vandalism', 'threat', 'medical', 'other']
  },
  description: { type: String, required: true },
  location: {
    description: { type: String },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number]  // [longitude, latitude]
    }
  },
  incidentDate: { type: Date, required: true },
  involvedStudentIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  involvedStaffIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved'],
    default: 'open'
  },
  resolution: { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { schoolId, incidentDate }, 2dsphere on location.coordinates
// Timestamps: true
```

### SafetyHotspot Schema

```typescript
// Model: SafetyHotspot | Collection: safety_hotspots
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  centroid: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]  // [longitude, latitude]
  },
  radiusMeters: { type: Number, required: true },
  incidentCount: { type: Number, required: true },
  incidentIds: [{ type: Schema.Types.ObjectId, ref: 'SafetyIncident' }],
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  modelVersion: { type: String, required: true },
  generatedAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date }
}
// Indexes: { schoolId, isActive }, 2dsphere on centroid
```

---

## 6. Transport Domain

### Bus Schema

```typescript
// Model: Bus | Collection: buses
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  registrationNumber: { type: String, required: true, unique: true, uppercase: true },
  make: { type: String },
  model: { type: String },
  capacity: { type: Number, required: true },
  currentDriverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  isActive: { type: Boolean, default: true },
  deviceId: { type: String, unique: true, sparse: true },  // GPS tracker device ID
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Indexes: { schoolId, isActive }, deviceId unique sparse
// Timestamps: true
```

### BusRoute Schema

```typescript
// Model: BusRoute | Collection: bus_routes
// Stops are embedded — bounded list, always accessed with route
{
  schoolId: { type: Schema.Types.ObjectId, required: true },
  busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  routeName: { type: String, required: true },
  routeCode: { type: String, required: true, uppercase: true },
  academicYear: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  stops: [{
    stopName: { type: String, required: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number]  // [longitude, latitude]
    },
    scheduledArrival: { type: String },  // HH:mm format
    scheduledDeparture: { type: String },
    order: { type: Number, required: true }
  }],
  estimatedDurationMinutes: { type: Number },
  createdAt: { type: Date },
  updatedAt: { type: Date }
}
// Unique: { schoolId, routeCode }
// Indexes: busId
// Timestamps: true
```

### GpsEvent Schema

```typescript
// Model: GpsEvent | Collection: gps_events
// High-frequency time-series — TTL index for 90-day retention
{
  busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  deviceId: { type: String, required: true },
  coordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]  // [longitude, latitude]
  },
  speed: { type: Number },
  heading: { type: Number },
  altitude: { type: Number },
  accuracy: { type: Number },
  timestamp: { type: Date, required: true, index: true },
  eventType: {
    type: String,
    enum: ['location', 'stop', 'ignition_on', 'ignition_off', 'panic', 'geofence'],
    default: 'location'
  }
}
// Indexes: { busId, timestamp }, { deviceId, timestamp }, 2dsphere on coordinates
// TTL index: { timestamp: 1 } expireAfterSeconds: 7776000  (90 days)
// No timestamps plugin — timestamp field IS the time
```

### BusAnomaly Schema

```typescript
// Model: BusAnomaly | Collection: bus_anomalies
{
  busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
  busRouteId: { type: Schema.Types.ObjectId, ref: 'BusRoute' },
  anomalyType: {
    type: String,
    required: true,
    enum: ['route_deviation', 'unexpected_stop', 'excessive_speed', 'extended_idle', 'panic_button', 'geofence_violation']
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  description: { type: String },
  relatedGpsEventIds: [{ type: Schema.Types.ObjectId, ref: 'GpsEvent' }],
  detectedAt: { type: Date, required: true },
  modelVersion: { type: String },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'false_positive', 'actioned'],
    default: 'new'
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  createdAt: { type: Date }
}
// Indexes: { busId, detectedAt }, { schoolId, status }, { severity, status }
```

---

## 7. AI Domain

### AiPrediction Schema (Academic Performance)

```typescript
// Model: AiPrediction | Collection: ai_predictions
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  predictionType: { type: String, default: 'performance', immutable: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
  academicYear: { type: String, required: true },
  period: { type: String },  // e.g., "Term 2"
  predictedGradeBand: { type: String },  // e.g., "A", "B+", "C"
  predictedScore: { type: Number },
  confidence: { type: Number, min: 0, max: 1 },
  inputFeatures: {
    attendanceRate: Number,
    homeworkCompletionRate: Number,
    avgPreviousScore: Number,
    engagementScore: Number
  },
  modelName: { type: String, required: true },
  modelVersion: { type: String, required: true },
  modelId: { type: Schema.Types.ObjectId, ref: 'ModelVersion' },
  status: {
    type: String,
    enum: ['pending', 'completed', 'error'],
    default: 'pending'
  },
  reviewStatus: {
    type: String,
    enum: ['unreviewed', 'accepted', 'noted', 'rejected'],
    default: 'unreviewed'
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date }
}
// Indexes: { studentId, createdAt }, { studentId, subjectId, academicYear }, { schoolId, createdAt }
```

### RiskScore Schema

```typescript
// Model: RiskScore | Collection: risk_scores
// RESTRICTED: counselors and admins only
{
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  riskScore: { type: Number, required: true, min: 0, max: 1 },
  riskCategory: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high']
  },
  contributingFactors: [{
    factor: { type: String },
    weight: { type: Number },
    value: Schema.Types.Mixed,
    description: { type: String }
  }],
  modelName: { type: String, required: true },
  modelVersion: { type: String, required: true },
  modelId: { type: Schema.Types.ObjectId, ref: 'ModelVersion' },
  assessmentDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'superseded'],
    default: 'active'
  },
  requiresCounselorReview: { type: Boolean, default: false },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  counselorNotes: { type: String },
  createdAt: { type: Date }
}
// Indexes: { studentId, assessmentDate }, { riskCategory, requiresCounselorReview }, { schoolId, createdAt }
```

### ModelVersion Schema

```typescript
// Model: ModelVersion | Collection: model_versions
{
  modelName: { type: String, required: true },
  modelType: {
    type: String,
    required: true,
    enum: [
      'performance_prediction',
      'risk_prediction',
      'wellbeing_nlp',
      'study_recommendation',
      'bus_anomaly',
      'safety_hotspot'
    ]
  },
  version: { type: String, required: true },
  trainingDate: { type: Date },
  datasetDescription: { type: String },
  metrics: {
    accuracy: Number,
    precision: Number,
    recall: Number,
    f1Score: Number,
    additionalMetrics: Schema.Types.Mixed
  },
  isActive: { type: Boolean, default: false },
  artifactPath: { type: String },
  createdAt: { type: Date }
}
// Unique: { modelName, version }, { modelType, isActive } (partial: when isActive=true, max 1)
```

---

## 8. Operations Domain

### AuditLog Schema

```typescript
// Model: AuditLog | Collection: audit_logs
// IMMUTABLE: never update or delete records
{
  schoolId: { type: Schema.Types.ObjectId },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userRole: { type: String },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'AI_PREDICTION', 'ALERT']
  },
  resourceType: { type: String, required: true },
  resourceId: { type: Schema.Types.ObjectId },
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, required: true, default: Date.now }
}
// Indexes: { schoolId, timestamp }, { userId, timestamp }, { resourceType, resourceId, timestamp }
// No update or delete operations on this collection — ever
```

---

## 9. Schema Implementation Notes

### Mongoose Best Practices Applied

1. **`select: false`** on sensitive fields (`passwordHash`, `refreshTokenHash`, `notes` in mood check-ins)
2. **`immutable: true`** on fields that should never change post-creation (e.g., `predictionType`)
3. **`timestamps: true`** on all mutable collections (adds `createdAt` and `updatedAt` automatically)
4. **Pre-save hooks** used for computed fields (e.g., `isPassed` in exam results)
5. **Sparse indexes** for optional unique fields (e.g., `deviceId` on buses)
6. **Enum validation** at schema level for all categorical fields
7. **`maxlength` validation** on all free-text user input fields
8. **GeoJSON standard format** (`{ type: 'Point', coordinates: [lng, lat] }`) for all geospatial fields

### Directory Structure for Models

```
/models
  /identity
    User.ts
    Student.ts
    Parent.ts
    Teacher.ts
    Counselor.ts
    Admin.ts
    ParentStudentRelationship.ts
    TeacherClassAssignment.ts
  /academic
    Class.ts
    Subject.ts
    Enrollment.ts
    Exam.ts
    ExamResult.ts
    Assignment.ts
    HomeworkSubmission.ts
    StudyMaterial.ts
  /attendance
    AttendanceRecord.ts
    LeaveRequest.ts
  /behavior
    BehaviorObservation.ts
    StudentEngagement.ts
  /wellbeing
    MoodCheckin.ts
    WellbeingSignal.ts
  /safety
    SafetyReport.ts
    SafetyIncident.ts
    SafetyLocation.ts
    SafetyHotspot.ts
  /transport
    Bus.ts
    Driver.ts
    BusRoute.ts
    StudentBusAssignment.ts
    GpsEvent.ts
    BusAnomaly.ts
  /communication
    Notice.ts
    Message.ts
    Notification.ts
  /ai
    AiPrediction.ts
    RiskScore.ts
    StudyRecommendation.ts
    AiSummary.ts
    AiInteraction.ts
    ModelVersion.ts
  /operations
    EmergencyAlert.ts
    VisitorRecord.ts
    GatePass.ts
    AuditLog.ts
  index.ts  // central model registration
```
