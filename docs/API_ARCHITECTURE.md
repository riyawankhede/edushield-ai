# API Architecture
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. API Design Philosophy

- All APIs are typed (TypeScript request/response interfaces)
- All APIs are versioned (`/api/v1/...`)
- All APIs enforce authentication and authorization at the middleware layer
- No business logic in API route handlers — logic lives in the service layer
- Consistent response envelope across all endpoints
- Pagination on all list endpoints
- Proper HTTP status codes

---

## 2. Response Envelope

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You are not authorized to access this resource.",
    "details": []
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|------------|---------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_ERROR` | 500 | Server error |
| `AI_SERVICE_ERROR` | 502 | ML service unavailable |
| `RATE_LIMITED` | 429 | Too many requests |

---

## 3. Authentication Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

---

## 4. API Route Groups

### 4.1 Student Routes

**Accessible by:** Student (own data), Teacher (class students), Parent (linked child), Counselor (all), Admin (all)

```
GET    /api/v1/students                         # List students (teacher: class-scoped; admin: school-wide)
POST   /api/v1/students                         # Create student (admin only)
GET    /api/v1/students/:studentId              # Student profile
PUT    /api/v1/students/:studentId              # Update profile (admin only)
DELETE /api/v1/students/:studentId              # Deactivate (admin only)

GET    /api/v1/students/:studentId/summary      # Academic summary dashboard data
GET    /api/v1/students/:studentId/attendance   # Attendance records
GET    /api/v1/students/:studentId/results      # Exam results
GET    /api/v1/students/:studentId/assignments  # Homework/assignments
GET    /api/v1/students/:studentId/risk-score   # Risk score (counselor/admin only)
GET    /api/v1/students/:studentId/wellbeing    # Well-being signals (counselor/admin only)
GET    /api/v1/students/:studentId/predictions  # Performance predictions (teacher/counselor/admin)
```

---

### 4.2 Attendance Routes

**Accessible by:** Teacher (own classes), Student (own), Parent (linked child), Admin (school-wide)

```
GET    /api/v1/attendance                       # Query attendance (role-scoped)
POST   /api/v1/attendance                       # Record attendance (teacher only)
PUT    /api/v1/attendance/:recordId             # Correct attendance record (teacher/admin)

GET    /api/v1/attendance/class/:classId        # Class attendance for a date
POST   /api/v1/attendance/class/:classId/bulk  # Bulk record attendance (teacher)

GET    /api/v1/leave-requests                   # List leave requests
POST   /api/v1/leave-requests                   # Submit leave request (student/parent)
PUT    /api/v1/leave-requests/:requestId        # Approve/reject (teacher/admin)
```

---

### 4.3 Academic Routes

```
# Classes
GET    /api/v1/classes                          # List classes (role-scoped)
POST   /api/v1/classes                          # Create class (admin)
GET    /api/v1/classes/:classId                 # Class details
PUT    /api/v1/classes/:classId                 # Update class (admin)
GET    /api/v1/classes/:classId/students        # Students in class

# Subjects
GET    /api/v1/subjects                         # List subjects
POST   /api/v1/subjects                         # Create subject (admin)

# Exams
GET    /api/v1/exams                            # List exams (role-scoped)
POST   /api/v1/exams                            # Create exam (teacher)
GET    /api/v1/exams/:examId                    # Exam details
PUT    /api/v1/exams/:examId                    # Update exam (teacher)

# Exam Results
GET    /api/v1/exams/:examId/results            # All results for exam (teacher/admin)
POST   /api/v1/exams/:examId/results            # Enter results (teacher)
POST   /api/v1/exams/:examId/results/bulk       # Bulk enter results (teacher)
GET    /api/v1/exams/:examId/results/:studentId # Single student result

# Study Materials
GET    /api/v1/study-materials                  # Browse materials (student/teacher)
POST   /api/v1/study-materials                  # Upload material (teacher)
GET    /api/v1/study-materials/:materialId      # Get material + signed URL
PUT    /api/v1/study-materials/:materialId      # Update (teacher who uploaded/admin)
DELETE /api/v1/study-materials/:materialId      # Delete (teacher who uploaded/admin)
```

---

### 4.4 Homework Routes

```
GET    /api/v1/assignments                      # List assignments (role-scoped)
POST   /api/v1/assignments                      # Create assignment (teacher)
GET    /api/v1/assignments/:assignmentId        # Assignment details
PUT    /api/v1/assignments/:assignmentId        # Update (teacher who created)

GET    /api/v1/assignments/:assignmentId/submissions         # All submissions (teacher)
POST   /api/v1/assignments/:assignmentId/submissions         # Submit assignment (student)
GET    /api/v1/assignments/:assignmentId/submissions/:studentId  # Single submission
PUT    /api/v1/assignments/:assignmentId/submissions/:studentId  # Grade submission (teacher)
```

---

### 4.5 Well-being Routes

```
# Mood Check-ins (student portal)
GET    /api/v1/mood-checkins/my                 # Student's own check-ins
POST   /api/v1/mood-checkins                    # Submit mood check-in (student)

# Well-being data (counselor/admin only)
GET    /api/v1/wellbeing/signals                # List flagged signals (counselor/admin)
GET    /api/v1/wellbeing/signals/:signalId      # Signal details with context
PUT    /api/v1/wellbeing/signals/:signalId/review  # Mark as reviewed
GET    /api/v1/wellbeing/students/:studentId    # Student well-being timeline (counselor)
GET    /api/v1/wellbeing/school/overview        # School-wide well-being stats (admin)
```

---

### 4.6 Safety Routes

```
# Student-facing
POST   /api/v1/safety/reports                   # Submit safety/bullying report (student, can be anonymous)
GET    /api/v1/safety/reports/my                # Student's own non-anonymous reports

# Staff-facing
GET    /api/v1/safety/reports                   # List safety reports (counselor/admin)
GET    /api/v1/safety/reports/:reportId         # Report details (counselor/admin)
PUT    /api/v1/safety/reports/:reportId         # Update status (counselor/admin)

# Incidents (admin/counselor)
GET    /api/v1/safety/incidents                 # List incidents
POST   /api/v1/safety/incidents                 # Create incident (admin/teacher)
GET    /api/v1/safety/incidents/:incidentId     # Incident details
PUT    /api/v1/safety/incidents/:incidentId     # Update incident

# Hotspots (admin — AI output)
GET    /api/v1/safety/hotspots                  # Current hotspots
POST   /api/v1/safety/hotspots/refresh          # Trigger ML analysis (admin)

# SOS (student emergency)
POST   /api/v1/safety/sos                       # Trigger SOS (student — no AI dependency)
```

---

### 4.7 Transport Routes

```
# Bus management (admin)
GET    /api/v1/transport/buses                  # List buses
POST   /api/v1/transport/buses                  # Create bus (admin)
GET    /api/v1/transport/buses/:busId           # Bus details
PUT    /api/v1/transport/buses/:busId           # Update bus (admin)
GET    /api/v1/transport/buses/:busId/location  # Current GPS location (parent/admin)
GET    /api/v1/transport/buses/:busId/anomalies # Bus anomaly history (admin)

# Routes
GET    /api/v1/transport/routes                 # List routes
POST   /api/v1/transport/routes                 # Create route (admin)
GET    /api/v1/transport/routes/:routeId        # Route details + stops

# Student assignments
GET    /api/v1/transport/my-bus                 # Student's bus assignment (student/parent)
POST   /api/v1/transport/assignments            # Assign student to bus (admin)

# GPS ingestion (device endpoint — special auth token)
POST   /api/v1/transport/gps                    # Ingest GPS event (device auth)

# Anomalies
GET    /api/v1/transport/anomalies              # List anomalies (admin)
PUT    /api/v1/transport/anomalies/:anomalyId/review  # Review anomaly (admin)
```

---

### 4.8 Communication Routes

```
# Notices
GET    /api/v1/notices                          # List notices (role-scoped)
POST   /api/v1/notices                          # Create notice (teacher/admin)
GET    /api/v1/notices/:noticeId                # Notice details
PUT    /api/v1/notices/:noticeId                # Update notice (creator/admin)
DELETE /api/v1/notices/:noticeId                # Delete (creator/admin)

# Messages
GET    /api/v1/messages                         # Inbox
POST   /api/v1/messages                         # Send message
GET    /api/v1/messages/:messageId              # Message details
PUT    /api/v1/messages/:messageId/read         # Mark as read

# Notifications
GET    /api/v1/notifications                    # My notifications
PUT    /api/v1/notifications/read-all           # Mark all read
DELETE /api/v1/notifications/:notificationId    # Dismiss
GET    /api/v1/notifications/stream             # SSE stream for real-time

# Emergency Alerts
GET    /api/v1/alerts                           # List alerts (admin)
POST   /api/v1/alerts                           # Create emergency alert (admin)
GET    /api/v1/alerts/stream                    # SSE stream (all authenticated users)
PUT    /api/v1/alerts/:alertId/resolve          # Resolve alert (admin)
```

---

### 4.9 AI Routes

```
# Performance Predictions (teacher/admin)
GET    /api/v1/ai/predictions/student/:studentId              # Student's predictions
POST   /api/v1/ai/predictions/student/:studentId/generate    # Request new prediction
PUT    /api/v1/ai/predictions/:predictionId/review            # Teacher review

# Risk Scores (counselor/admin only)
GET    /api/v1/ai/risk/student/:studentId                     # Student risk assessment
GET    /api/v1/ai/risk/school/overview                        # School risk distribution (admin)
PUT    /api/v1/ai/risk/:riskScoreId/review                   # Counselor review

# Study Recommendations (student)
GET    /api/v1/ai/recommendations/my                          # My recommendations
POST   /api/v1/ai/recommendations/generate                    # Request new recommendations

# AI Study Assistant (student)
POST   /api/v1/ai/study-assistant/chat                        # Send message
GET    /api/v1/ai/study-assistant/sessions                    # My session history
GET    /api/v1/ai/study-assistant/sessions/:sessionId         # Session detail

# AI Parent Assistant (parent)
POST   /api/v1/ai/parent-assistant/chat                       # Send message (scoped to linked children)

# AI Generation (teacher/admin)
POST   /api/v1/ai/generate/report                             # Generate student report draft
POST   /api/v1/ai/generate/notice                             # Generate notice draft
POST   /api/v1/ai/translate                                   # Translate text

# AI Summaries (parent/admin)
GET    /api/v1/ai/summaries/student/:studentId/weekly         # Weekly parent summary
POST   /api/v1/ai/summaries/student/:studentId/weekly/generate # Generate weekly summary
```

---

### 4.10 Admin Routes

```
# User management
GET    /api/v1/admin/users                      # List all users (admin)
POST   /api/v1/admin/users                      # Create user (admin)
PUT    /api/v1/admin/users/:userId              # Update user
DELETE /api/v1/admin/users/:userId              # Deactivate user

# Analytics
GET    /api/v1/admin/analytics/school           # School-wide stats
GET    /api/v1/admin/analytics/attendance       # Attendance trends
GET    /api/v1/admin/analytics/academic         # Academic performance trends
GET    /api/v1/admin/analytics/risk             # Risk distribution (admin)

# Visitor management
GET    /api/v1/admin/visitors                   # Today's visitor log
POST   /api/v1/admin/visitors                   # Check-in visitor
PUT    /api/v1/admin/visitors/:visitorId/checkout  # Check out

# Gate passes
GET    /api/v1/admin/gate-passes                # List gate passes
POST   /api/v1/admin/gate-passes                # Create gate pass
GET    /api/v1/admin/gate-passes/verify/:qrCode # Verify QR code
PUT    /api/v1/admin/gate-passes/:passId/use    # Mark as used

# Audit logs
GET    /api/v1/admin/audit-logs                 # Query audit logs (admin only)
```

---

## 5. Middleware Stack

Every API request passes through:

```
Request
  → Edge Middleware (JWT verify, role routing)
  → API Route Handler
  → withAuth()          // verify JWT, attach user to context
  → withRole(roles[])   // verify role is permitted
  → withRateLimit()     // where applicable
  → Handler
  → withAuditLog()      // log action to audit_logs
  → Response
```

### Middleware Implementations

```typescript
// withAuth: Extracts and verifies JWT, attaches user to request context
// withRole: Checks if user.role is in permitted roles array
// withResourceOwnership: Verifies user can access specific resource
// withAuditLog: Writes to audit_logs collection after handler
// withRateLimit: Applied to AI endpoints and auth endpoints
```

---

## 6. ML Service API Contract

The Next.js backend communicates with the Python ML service over authenticated HTTP.

### Authentication

```
Header: X-Service-API-Key: <ML_SERVICE_API_KEY>
```

### ML Service Endpoints

```
POST /predict/performance
Body: { studentId, features: { attendanceRate, avgScore, homeworkRate, engagementScore, ... } }
Response: { predictedGradeBand, predictedScore, confidence, modelName, modelVersion }

POST /predict/risk
Body: { studentId, features: { performanceTrend, attendanceAnomaly, moodScores, engagementScores, ... } }
Response: { riskScore, riskCategory, contributingFactors, modelName, modelVersion }

POST /analyze/wellbeing
Body: { text, checkinId }
Response: { signalType, confidence, severity, modelVersion }

POST /recommend/study
Body: { studentId, subjectPerformance: [{ subjectId, avgScore, weakTopics }], availableMaterials: [...] }
Response: { recommendations: [{ subjectId, topic, priority, reason, materialIds }] }

POST /detect/bus-anomaly
Body: { busId, routeId, gpsEvents: [...], routeDefinition: {...} }
Response: { anomalies: [{ type, severity, description, relatedEventIndices }] }

POST /detect/safety-hotspots
Body: { schoolId, incidents: [{ id, coordinates, date }], analysisWindow: { from, to } }
Response: { hotspots: [{ centroid, radius, incidentIds, severity }] }

GET  /health
Response: { status: 'ok', models: [{ name, version, isLoaded }] }
```

---

## 7. Pagination Standard

All list endpoints use cursor/offset pagination:

```
Query Params:
  page (default: 1)
  pageSize (default: 20, max: 100)

Response meta:
  page, pageSize, total, totalPages
```

---

## 8. API Security Rules

1. **No route without auth** — every endpoint requires authentication except `/api/v1/auth/login`
2. **No role without resource check** — role check is necessary but not sufficient; resource ownership must also be verified
3. **AI endpoints are rate-limited** — prevent abuse of Gemini API
4. **GPS ingest endpoint** uses device API key, not user JWT
5. **Anonymous report endpoint** strips reporter identity before storage when `isAnonymous=true`
6. **Risk and well-being endpoints** have additional role gates (counselor/admin only)
7. **Audit logging** on all mutations and sensitive reads
