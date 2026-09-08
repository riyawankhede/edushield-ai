# Database Design
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. Database Philosophy

MongoDB is chosen as the primary database. Before defining collections, we apply the following MongoDB design principles:

### 1.1 Embedding vs. Referencing

| Embed when... | Reference when... |
|---------------|-------------------|
| Data is accessed together almost always | Data is accessed independently |
| Child data has no independent lifecycle | Child data has its own lifecycle |
| Child data is bounded in size | Child data is unbounded (grows over time) |
| Child data is not shared between documents | Data is shared by multiple parent documents |
| Data does not need its own indexes | Data needs to be queried independently |

### 1.2 Document Size

- Keep documents under 16MB hard limit (MongoDB limit)
- For arrays that grow unboundedly (e.g., GPS events), use separate collections
- For small bounded arrays (e.g., bus stop list on a route), embed

---

## 2. Collection Design Decisions

### Decision Table

| Entity | Design | Rationale |
|--------|--------|-----------|
| User authentication | `users` collection (reference) | Auth data is shared across roles; referenced by all role profiles |
| Student profile | `students` collection (reference) | Core entity, accessed independently by many systems |
| Parent profile | `parents` collection (reference) | Linked to students via separate `parent_student_relationships` |
| Teacher profile | `teachers` collection (reference) | Linked to classes via `teacher_class_assignments` |
| Admin/Counselor profiles | `admins` / `counselors` (reference) | Separate role profiles linked to `users` |
| Parent-student link | `parent_student_relationships` | Many-to-many, explicit join collection |
| Teacher-class link | `teacher_class_assignments` | Many-to-many with subject scope |
| Classes | `classes` collection | Independent entity, referenced by many |
| Subjects | `subjects` collection | Shared across classes |
| Enrollments | `enrollments` collection | Student-class-subject relationship, independent lifecycle |
| Exams | `exams` collection | Independent lifecycle, referenced by results |
| Exam results | `exam_results` collection | Large, grows per student per exam; independent |
| Assignments / Homework | `assignments` collection | Assigned by teacher, consumed by students |
| Homework submissions | `homework_submissions` collection | Student-specific, linked to assignment; independent |
| Study materials | `study_materials` collection | School resource library, queried independently |
| Attendance records | `attendance_records` collection | High volume, unbounded growth; needs own indexes |
| Leave requests | `leave_requests` collection | Independent approval workflow |
| Behavior observations | `behavior_observations` collection | Teacher-to-student records; independent |
| Student engagement | `student_engagement` collection | Periodic scores; time-series nature |
| Mood check-ins | `mood_checkins` collection | Sensitive; daily per student; NLP inputs |
| Well-being signals | `wellbeing_signals` collection | AI-generated from mood data; separate from raw input |
| Safety reports | `safety_reports` collection | Sensitive; separate collection; strict access |
| Safety categories | Embedded in `safety_reports` | Small, stable enum-like; no independent queries |
| Safety locations | `safety_locations` collection | Reusable geospatial points |
| Safety incidents | `safety_incidents` collection | Formal school-level incident records |
| Safety hotspots | `safety_hotspots` collection | AI-generated output; separate from incidents |
| Buses | `buses` collection | Fleet management |
| Drivers | `drivers` collection | Independent profile |
| Bus routes | `bus_routes` collection | Route + stops embedded (bounded, accessed together) |
| Bus stops | Embedded in `bus_routes` | Always accessed with route; bounded list |
| Student bus assignments | `student_bus_assignments` collection | Student-to-route mapping; independent |
| GPS events | `gps_events` collection | High-frequency time-series; never embed |
| Bus anomalies | `bus_anomalies` collection | AI output; separate from raw GPS |
| Notices | `notices` collection | School communications |
| Messages | `messages` collection | Direct user-to-user messaging |
| Notifications | `notifications` collection | System-generated alerts per user |
| AI predictions (performance) | `ai_predictions` collection (typed) | Audit trail; independent lifecycle |
| Risk scores | `risk_scores` collection | Separate from performance predictions; different consumers |
| Study recommendations | `study_recommendations` collection | AI output; linked to student |
| AI summaries | `ai_summaries` collection | Gemini-generated summaries (weekly digests etc.) |
| AI interactions | `ai_interactions` collection | Chat history for Study Assistant / Parent Assistant |
| Model versions | `model_versions` collection | ML model registry |
| Emergency alerts | `emergency_alerts` collection | Time-critical; separate |
| Visitor records | `visitor_records` collection | Operational log |
| Gate passes | `gate_passes` collection | QR-linked; independent |
| Audit logs | `audit_logs` collection | Immutable security log |

---

## 3. Collection Inventory

### 3.1 Identity Domain

#### `users`
Central authentication and identity record.

```
Fields: _id, email, passwordHash, role, schoolId, isActive,
        lastLoginAt, refreshTokenHash, createdAt, updatedAt
Indexes: email (unique), schoolId+role
```

#### `students`
Student profile data.

```
Fields: _id, userId (ref), schoolId, studentCode, firstName, lastName,
        dateOfBirth, gender, grade, section, enrollmentDate, isActive,
        emergencyContact (embedded: name, phone, relationship),
        address (embedded), profileImageUrl, createdAt, updatedAt
Indexes: schoolId+grade+section, studentCode (unique per school), userId (unique)
```

#### `parents`
Parent/guardian profile.

```
Fields: _id, userId (ref), firstName, lastName, phone, occupation,
        preferredLanguage, createdAt, updatedAt
Indexes: userId (unique)
```

#### `teachers`
Teacher profile.

```
Fields: _id, userId (ref), schoolId, staffCode, firstName, lastName,
        phone, qualification, specializations (array), isActive,
        createdAt, updatedAt
Indexes: userId (unique), schoolId, staffCode (unique per school)
```

#### `counselors`
Counselor profile.

```
Fields: _id, userId (ref), schoolId, staffCode, firstName, lastName,
        phone, qualification, isActive, createdAt, updatedAt
Indexes: userId (unique), schoolId
```

#### `admins`
Admin profile.

```
Fields: _id, userId (ref), schoolId, staffCode, firstName, lastName,
        phone, adminLevel (school | super), isActive, createdAt, updatedAt
Indexes: userId (unique), schoolId
```

#### `parent_student_relationships`
Explicit many-to-many link between parents and students.

```
Fields: _id, parentId (ref parents), studentId (ref students),
        relationship (mother|father|guardian|other),
        isPrimary, canReceiveAlerts, accessPermissions (flags),
        schoolId, createdAt, updatedAt
Indexes: parentId, studentId, parentId+studentId (unique)
```

#### `teacher_class_assignments`
Which teacher teaches which subject in which class.

```
Fields: _id, teacherId (ref teachers), classId (ref classes),
        subjectId (ref subjects), academicYear, isActive,
        schoolId, createdAt, updatedAt
Indexes: teacherId, classId+subjectId, schoolId+academicYear
```

---

### 3.2 Academic Domain

#### `classes`
Class/section definition.

```
Fields: _id, schoolId, name, grade, section, academicYear,
        roomNumber, isActive, createdAt, updatedAt
Indexes: schoolId+academicYear+grade+section (unique)
```

#### `subjects`
Subject/course catalog.

```
Fields: _id, schoolId, name, code, description, gradeLevel,
        isActive, createdAt, updatedAt
Indexes: schoolId+code (unique)
```

#### `enrollments`
Student enrolled in a class for an academic year.

```
Fields: _id, studentId (ref), classId (ref), academicYear,
        enrollmentDate, isActive, schoolId, createdAt, updatedAt
Indexes: studentId+academicYear, classId+academicYear, studentId+classId+academicYear (unique)
```

#### `exams`
Exam definition.

```
Fields: _id, schoolId, classId (ref), subjectId (ref), name, type
        (unit_test|mid_term|final|assignment|quiz), maxMarks,
        passingMarks, examDate, academicYear, createdBy (ref users),
        isPublished, createdAt, updatedAt
Indexes: classId+subjectId+academicYear, schoolId+examDate
```

#### `exam_results`
Individual student exam results.

```
Fields: _id, studentId (ref), examId (ref), marksObtained,
        grade, isPassed, remarks, enteredBy (ref users),
        schoolId, createdAt, updatedAt
Indexes: studentId+examId (unique), examId, studentId+schoolId
```

#### `assignments`
Teacher-assigned homework or projects.

```
Fields: _id, schoolId, classId (ref), subjectId (ref), teacherId (ref),
        title, description, dueDate, maxMarks, attachments (array of URLs),
        type (homework|project|classwork), isActive, createdAt, updatedAt
Indexes: classId+dueDate, teacherId, schoolId+createdAt
```

#### `homework_submissions`
Student submissions for assignments.

```
Fields: _id, assignmentId (ref), studentId (ref), submittedAt,
        content, attachmentUrls (array), marksAwarded, feedback,
        status (submitted|late|graded|missing), gradedBy (ref users),
        gradedAt, schoolId, createdAt, updatedAt
Indexes: assignmentId, studentId, assignmentId+studentId (unique), studentId+status
```

#### `study_materials`
Study content uploaded by teachers.

```
Fields: _id, schoolId, subjectId (ref), grade, title, description,
        fileUrl, fileType (pdf|video|slide|link), uploadedBy (ref users),
        tags (array), isPublished,
        embedding (vector, for Atlas Vector Search),
        embeddingModel, embeddingGeneratedAt,
        createdAt, updatedAt
Indexes: subjectId+grade, schoolId+isPublished, Atlas Vector Index on embedding
```

---

### 3.3 Attendance Domain

#### `attendance_records`
Daily attendance per student per class.

```
Fields: _id, studentId (ref), classId (ref), date, status
        (present|absent|late|excused), remarks, recordedBy (ref users),
        schoolId, createdAt, updatedAt
Indexes: studentId+date (unique per class), classId+date, studentId+schoolId+date
```

#### `leave_requests`
Student leave applications.

```
Fields: _id, studentId (ref), requestedBy (ref users, parent or student),
        fromDate, toDate, reason, status (pending|approved|rejected),
        reviewedBy (ref users), reviewedAt, schoolId, createdAt, updatedAt
Indexes: studentId, schoolId+status, fromDate
```

---

### 3.4 Behavior Domain

#### `behavior_observations`
Teacher-recorded behavioral notes about a student.

```
Fields: _id, studentId (ref), teacherId (ref), classId (ref),
        observationType (positive|concern|neutral),
        category (engagement|participation|conduct|social|academic),
        description, severity (1-5), isPrivate,
        schoolId, createdAt, updatedAt
Indexes: studentId, teacherId, studentId+createdAt, schoolId+observationType
```

#### `student_engagement`
Periodic engagement score per student per subject.

```
Fields: _id, studentId (ref), classId (ref), subjectId (ref),
        period (week|month), periodStartDate, engagementScore (0-100),
        participationScore, homeworkCompletionRate, attendanceRate,
        computedBy (manual|system), schoolId, createdAt
Indexes: studentId+period+periodStartDate, classId+period
```

---

### 3.5 Well-being Domain

#### `mood_checkins`
Daily student mood self-report.

```
Fields: _id, studentId (ref), date, moodScore (1-5),
        moodLabel (great|good|okay|low|struggling),
        notes (free text - sensitive), isAnonymous,
        nlpAnalyzed (bool), nlpAnalyzedAt,
        schoolId, createdAt
Indexes: studentId+date (unique), schoolId+date, nlpAnalyzed+createdAt (for batch processing)
Note: notes field is sensitive — access restricted to counselors
```

#### `wellbeing_signals`
AI-derived signals from mood check-in data. Separate from raw check-ins.

```
Fields: _id, studentId (ref), sourceCheckinId (ref mood_checkins),
        signalType (distress|isolation|aggression|bullying|positive),
        confidence (0-1), severity (low|medium|high),
        modelVersion, requiresCounselorReview, reviewedBy (ref users),
        reviewedAt, schoolId, createdAt
Indexes: studentId, requiresCounselorReview+severity, schoolId+createdAt
Note: Only counselors and admins can access
```

---

### 3.6 Safety Domain

#### `safety_reports`
Student-submitted safety/bullying reports. Anonymous by design.

```
Fields: _id, schoolId, reporterStudentId (ref, nullable for anonymous),
        isAnonymous, reportType (bullying|threat|unsafe_area|other),
        description, locationDescription, involvedParties (array, optional),
        attachmentUrls, status (new|under_review|resolved|closed),
        assignedTo (ref users, counselor), nlpAnalyzed, nlpSignals (embedded),
        createdAt, updatedAt
Indexes: schoolId+status, assignedTo, schoolId+createdAt
Note: reporterStudentId must NEVER be exposed when isAnonymous=true
```

#### `safety_incidents`
Formal school-level incident records (created by staff, not students).

```
Fields: _id, schoolId, title, incidentType, description,
        location (embedded: description, coordinates GeoJSON),
        incidentDate, involvedStudentIds (array ref),
        involvedStaffIds (array ref), reportedBy (ref users),
        status (open|investigating|resolved),
        resolution, createdAt, updatedAt
Indexes: schoolId+incidentDate, location (2dsphere for geospatial)
```

#### `safety_locations`
Known locations relevant to safety monitoring.

```
Fields: _id, schoolId, name, locationType (classroom|corridor|playground|entrance|bus_stop|off_campus),
        coordinates (GeoJSON Point), createdAt
Indexes: schoolId, coordinates (2dsphere)
```

#### `safety_hotspots`
AI-detected geographic clusters of safety incidents.

```
Fields: _id, schoolId, centroid (GeoJSON Point),
        radiusMeters, incidentCount, incidentIds (array ref),
        period (start/end dates), severity (low|medium|high),
        modelVersion, generatedAt, isActive, createdAt
Indexes: schoolId+isActive, centroid (2dsphere)
```

---

### 3.7 Transport Domain

#### `buses`
School bus fleet.

```
Fields: _id, schoolId, registrationNumber, make, model, capacity,
        currentDriverId (ref drivers), isActive, deviceId (GPS tracker),
        createdAt, updatedAt
Indexes: schoolId+isActive, deviceId (unique)
```

#### `drivers`
Bus driver records.

```
Fields: _id, schoolId, firstName, lastName, licenseNumber,
        phone, isActive, createdAt, updatedAt
Indexes: schoolId, licenseNumber (unique)
```

#### `bus_routes`
Route definitions with embedded stops (stops list is bounded and always accessed with route).

```
Fields: _id, schoolId, busId (ref), routeName, routeCode,
        academicYear, isActive,
        stops (embedded array):
          - stopName, coordinates (GeoJSON), scheduledArrival, scheduledDeparture, order
        estimatedDuration, createdAt, updatedAt
Indexes: schoolId+routeCode (unique), busId
```

#### `student_bus_assignments`
Student assigned to a route and specific stops.

```
Fields: _id, studentId (ref), busRouteId (ref), boardingStopIndex,
        alightingStopIndex, academicYear, isActive,
        schoolId, createdAt, updatedAt
Indexes: studentId+academicYear (unique), busRouteId, schoolId
```

#### `gps_events`
High-frequency GPS event stream from bus tracker hardware.

```
Fields: _id, busId (ref), deviceId, coordinates (GeoJSON Point),
        speed, heading, timestamp, eventType (location|stop|ignition_on|ignition_off|panic),
        altitude, accuracy
Indexes: busId+timestamp, deviceId+timestamp, coordinates (2dsphere)
TTL index: 90-day data retention on timestamp
```

#### `bus_anomalies`
ML-detected anomalous bus events.

```
Fields: _id, busId (ref), busRouteId (ref), anomalyType
        (route_deviation|unexpected_stop|excessive_speed|extended_idle|panic_button),
        severity (low|medium|high), description,
        relatedGpsEventIds (array ref), detectedAt,
        modelVersion, status (new|reviewed|false_positive|actioned),
        reviewedBy (ref users), schoolId, createdAt
Indexes: busId+detectedAt, schoolId+status, severity+status
```

---

### 3.8 Communication Domain

#### `notices`
School notices and announcements.

```
Fields: _id, schoolId, title, content, audience (all|students|parents|teachers|specific_class),
        targetClassIds (array ref), publishedAt, expiresAt,
        isPublished, createdBy (ref users), attachmentUrls,
        isAiGenerated, aiGenerationMetadata (embedded), createdAt, updatedAt
Indexes: schoolId+isPublished+publishedAt, audience
```

#### `messages`
Direct messages between users.

```
Fields: _id, schoolId, fromUserId (ref), toUserId (ref),
        subject, content, isRead, readAt,
        threadId (for reply chains), parentMessageId (ref),
        createdAt
Indexes: toUserId+isRead, fromUserId, threadId, schoolId+createdAt
```

#### `notifications`
System-generated notifications per user.

```
Fields: _id, userId (ref), schoolId, type (alert|info|reminder|emergency),
        title, body, isRead, readAt, link (relative URL),
        priority (low|normal|high|emergency), createdAt, expiresAt
Indexes: userId+isRead, userId+createdAt, priority+isRead
TTL index: 30-day retention for normal notifications
```

---

### 3.9 AI Domain

#### `ai_predictions`
Academic performance predictions.

```
Fields: _id, studentId (ref), schoolId, predictionType (performance),
        subjectId (ref), academicYear, period,
        predictedGradeBand, predictedScore, confidence,
        inputFeatures (embedded summary of features used),
        modelName, modelVersion, modelId (ref model_versions),
        status (pending|completed|error), reviewedBy (ref users),
        reviewStatus (unreviewed|accepted|rejected), createdAt
Indexes: studentId+createdAt, studentId+subjectId+academicYear, schoolId+createdAt
```

#### `risk_scores`
Student risk assessment scores. Separate collection from performance predictions.

```
Fields: _id, studentId (ref), schoolId,
        riskScore (0-1), riskCategory (low|medium|high),
        contributingFactors (array: {factor, weight, value}),
        modelName, modelVersion, modelId (ref model_versions),
        assessmentDate, status (active|superseded),
        requiresCounselorReview, reviewedBy (ref users), reviewedAt,
        counselorNotes, createdAt
Indexes: studentId+assessmentDate, riskCategory+requiresCounselorReview, schoolId+createdAt
Note: Restricted to counselors and admins
```

#### `study_recommendations`
AI-generated personalized study plans.

```
Fields: _id, studentId (ref), schoolId, generatedAt,
        recommendations (array: {subjectId, topicName, priority, reason, suggestedMaterialIds}),
        modelName, modelVersion, isActive, studentAcknowledgedAt, createdAt
Indexes: studentId+generatedAt, studentId+isActive
```

#### `ai_summaries`
Gemini-generated summaries (weekly parent digests, class reports, etc.).

```
Fields: _id, schoolId, summaryType (weekly_parent|class_report|term_report),
        targetId (studentId or classId), targetType (student|class),
        content, generatedAt, periodStart, periodEnd,
        modelName, modelVersion, tokenCount, parentId (ref, for parent summaries),
        deliveredAt, createdAt
Indexes: targetId+summaryType+generatedAt, parentId+generatedAt
```

#### `ai_interactions`
Conversation history for AI Study Assistant and AI Parent Assistant.

```
Fields: _id, userId (ref), schoolId, assistantType (study_assistant|parent_assistant),
        sessionId, messages (embedded array - bounded per session):
          - role (user|assistant), content, timestamp, sourceDocIds
        totalTokens, createdAt, lastMessageAt
Indexes: userId+assistantType+lastMessageAt, sessionId (unique)
Note: Messages embedded per session (bounded). New sessions created for each conversation.
```

#### `model_versions`
ML model registry.

```
Fields: _id, modelName, modelType (performance_prediction|risk_prediction|wellbeing_nlp|
        study_recommendation|bus_anomaly|safety_hotspot),
        version, trainingDate, datasetDescription, metrics (embedded),
        isActive, artifactPath, createdAt
Indexes: modelType+isActive (unique per type where isActive=true), modelName+version (unique)
```

---

### 3.10 Operations Domain

#### `emergency_alerts`
School emergency broadcasts.

```
Fields: _id, schoolId, alertType (lockdown|fire|medical|weather|security|other),
        title, message, severity (low|medium|high|critical),
        triggeredBy (ref users), triggeredAt, resolvedAt, resolvedBy (ref users),
        affectedAreas (array), notificationsSent (count), status (active|resolved),
        createdAt, updatedAt
Indexes: schoolId+status, triggeredAt, severity+status
```

#### `visitor_records`
Physical visitor log.

```
Fields: _id, schoolId, visitorName, visitorPhone, idType, idNumber,
        purpose, hostUserId (ref, person being visited), hostName,
        checkInAt, checkOutAt, gatePassId (ref gate_passes),
        photo (optional URL), status (checked_in|checked_out),
        createdBy (ref users), createdAt, updatedAt
Indexes: schoolId+checkInAt, hostUserId, status+schoolId
```

#### `gate_passes`
Digital gate passes for student exits.

```
Fields: _id, schoolId, studentId (ref), requestedBy (ref users),
        purpose, authorizedBy (ref users), validFrom, validUntil,
        qrCode (unique token), status (pending|approved|used|expired),
        usedAt, createdAt, updatedAt
Indexes: schoolId+status, studentId, qrCode (unique), validUntil+status
```

#### `audit_logs`
Immutable security and action audit trail.

```
Fields: _id, schoolId, userId (ref), userRole, action,
        resourceType, resourceId, changes (before/after for mutations),
        ipAddress, userAgent, timestamp
Indexes: schoolId+timestamp, userId+timestamp, resourceType+resourceId+timestamp
Note: NEVER delete or update audit log records
```

---

## 4. Index Strategy Summary

### Critical Indexes

All collections must have:
- `schoolId` index (most queries are school-scoped)
- `createdAt` / `updatedAt` for temporal queries
- Unique constraints on natural keys

Performance-critical compound indexes:
- `attendance_records`: `(studentId, date, classId)` — daily attendance lookups
- `gps_events`: `(busId, timestamp)` — real-time bus tracking
- `exam_results`: `(studentId, schoolId)` — student report card generation
- `mood_checkins`: `(studentId, date)` — longitudinal well-being tracking
- `audit_logs`: `(schoolId, timestamp)` — security queries

### Atlas Vector Index
- `study_materials.embedding` — used for RAG in AI Study Assistant and AI Parent Assistant

### Geospatial Indexes
- `safety_incidents.location.coordinates` (2dsphere)
- `safety_locations.coordinates` (2dsphere)
- `safety_hotspots.centroid` (2dsphere)
- `gps_events.coordinates` (2dsphere)
- `bus_routes.stops.coordinates` (2dsphere)

---

## 5. Data Retention

| Collection | Retention | Mechanism |
|-----------|-----------|-----------|
| `gps_events` | 90 days | TTL index on `timestamp` |
| `notifications` | 30 days (normal) | TTL index on `expiresAt` |
| `audit_logs` | Permanent | No TTL |
| `ai_interactions` | 1 year | Scheduled cleanup job |
| Student records | Duration of enrollment + archival | Soft delete via `isActive` |

---

## 6. Multi-tenancy

The MVP targets a single school. All collections include a `schoolId` field. This field:
- Is indexed on all collections
- Is included in all queries
- Enables future multi-school federation without schema changes
