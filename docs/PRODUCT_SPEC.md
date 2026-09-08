# Product Specification
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0 (Architecture Phase)
**Date:** 2026-08-20
**Status:** Pre-implementation — Architecture & Documentation Phase

---

## 1. Executive Summary

This platform is a comprehensive school ecosystem that consolidates academic, behavioral, safety, and well-being data into a single intelligent system. The platform's core value proposition is converting raw operational school data into actionable insights, surfaced to the right role at the right time, with appropriate human oversight at every stage.

The system is **not** a simple student information system (SIS). It is a data-driven decision-support platform that augments human judgment — it does not replace it.

### Core Loop

```
DATA COLLECTION
    → STRUCTURED STORAGE (MongoDB)
    → ANALYSIS (ML Service / Rule-based)
    → AI INSIGHT (Surfaced to appropriate role)
    → HUMAN REVIEW & DECISION
    → INTERVENTION
    → NEW DATA
    → CONTINUOUS IMPROVEMENT
```

---

## 2. Product Goals

| Goal | Description |
|------|-------------|
| **Academic Intelligence** | Surface trends, predict performance trajectory, recommend study interventions |
| **Well-being Monitoring** | Detect early distress signals from mood check-ins and behavioral data |
| **Safety** | Identify bullying signals, safety hotspots, and manage emergency workflows |
| **Transportation Safety** | Monitor GPS data for anomalous bus behavior |
| **Operational Efficiency** | Automate routine communication, report generation, and administrative workflows |
| **Role-appropriate Access** | Every user sees exactly what they are authorized to see |

---

## 3. Non-Goals (MVP Scope)

- Biometric or facial recognition integration
- Real-time video surveillance
- AI that autonomously creates formal student records
- Integration with external government education databases (Phase 2+)
- Native mobile application (responsive web only for MVP)
- Multi-school / district-level federation (single school MVP)
- Payment or fee management

---

## 4. User Roles & Responsibilities

### 4.1 Student

A student is the primary data subject of the system. Students interact with the platform for:
- Viewing homework, study materials, and exam schedules
- Accessing the AI Study Assistant
- Receiving personalized study recommendations
- Submitting anonymous safety/bullying reports
- Recording daily mood check-ins
- Accessing their bus schedule and status
- Sending an SOS in emergency situations

Students can only access their **own** data. They cannot view other students' records.

---

### 4.2 Parent / Guardian

Parents are connected to one or more students via an explicit `parent_student_relationship`. Parents interact with the platform to:
- Monitor academic results, homework, attendance
- Receive automated AI weekly summaries of their child
- Use the AI Parent Assistant (Q&A about their child's data)
- View school notices
- Track the school bus in real-time
- Receive emergency alerts

Parents can only access data for their **linked children**. All data access is scoped through the relationship.

---

### 4.3 Teacher

Teachers manage classes, subjects, attendance, and academic records. Teachers interact with the platform to:
- Record attendance and marks
- Assign homework and study materials
- Record behavioral/engagement observations
- View AI-generated performance predictions for their students
- View AI risk flags (limited — counselor-grade detail is not visible)
- Generate AI-powered reports and notices
- Access AI-powered translation for communications

Teachers can only access students enrolled in **their assigned classes/subjects**.

---

### 4.4 Counselor

Counselors focus on student well-being and safety. They interact with the platform to:
- Review mood check-in data and flagged well-being signals
- Manage safety reports (including anonymous bullying reports)
- Review AI risk scores with supporting rationale
- Create and manage intervention plans
- Coordinate with teachers and admins on flagged cases

Counselors have read access to well-being and safety data across the school. They do **not** have access to routine academic management functions.

---

### 4.5 School Administrator

Admins manage the school operationally. They interact with the platform to:
- Manage student, teacher, and user records
- View school-wide analytics and AI risk analytics
- Manage safety incidents, emergency alerts, and bus operations
- Oversee visitor management and digital gate passes
- Access audit logs and system health

Admins have broad data access but within their own school's boundary.

---

## 5. Portal Feature Matrix

### Parent Portal

| Feature | AI-Powered | Notes |
|---------|------------|-------|
| Dashboard | No | Aggregated child data |
| Attendance view | No | Read-only |
| Academic results | No | Read-only |
| Homework tracker | No | Read-only |
| Exam results | No | Read-only |
| Notices | No | School-wide and personal |
| Teacher messaging | No | Direct secure messaging |
| AI weekly summary | **Yes** | Gemini-generated weekly digest |
| AI parent assistant | **Yes** | RAG-powered Q&A on child's data |
| School bus tracking | No | Real-time map, Leaflet/OSM |
| Emergency alerts | No | Push notification |

### Teacher Portal

| Feature | AI-Powered | Notes |
|---------|------------|-------|
| Dashboard | No | Class-scoped overview |
| Student management | No | Class roster, profiles |
| Attendance recording | No | Bulk/individual entry |
| Marks entry | No | Per exam/assessment |
| Homework management | No | Assign, track, review |
| Behavior observations | No | Structured notes |
| Performance prediction | **Yes** | ML model inference |
| Student risk flags | **Yes** | Risk score + flag reason (limited detail) |
| AI report generation | **Yes** | Gemini-generated student reports |
| AI notice generation | **Yes** | Gemini-generated notices |
| Translation | **Yes** | Gemini-powered multilingual output |
| AI insights | **Yes** | Class-level trend analysis |

### Student Portal

| Feature | AI-Powered | Notes |
|---------|------------|-------|
| Dashboard | No | Personal academic summary |
| Homework | No | View assigned tasks |
| Study materials | No | Browse/download |
| AI Study Assistant | **Yes** | Gemini RAG-powered Q&A |
| Personalized Study Planner | **Yes** | ML recommendation-driven |
| Mood check-in | No | Daily structured entry |
| Anonymous safety report | No | Encrypted, anonymized |
| Student SOS | No | Emergency escalation (no AI dependency) |
| Bus information | No | Schedule and live map |
| Notices | No | School-wide notices |

### Counselor Portal

| Feature | AI-Powered | Notes |
|---------|------------|-------|
| Dashboard | No | Well-being overview |
| Well-being cases | **Yes** | NLP-flagged mood signals |
| Safety reports | No | Human review workflow |
| Risk insights | **Yes** | AI risk scores + explanation |
| Intervention management | No | Case tracking |

### Admin Portal

| Feature | AI-Powered | Notes |
|---------|------------|-------|
| Dashboard | No | School-wide summary |
| Student management | No | CRUD |
| Teacher management | No | CRUD |
| School analytics | No | Recharts dashboards |
| AI risk analytics | **Yes** | School-wide risk heatmaps |
| Safety reports | No | Aggregated |
| Safety hotspot detection | **Yes** | ML clustering |
| Emergency management | No | Alert workflows (no AI dependency) |
| Bus management | No | Fleet overview |
| Bus anomaly detection | **Yes** | ML GPS event analysis |
| Visitor management | No | Visitor log |
| Digital gate passes | No | QR-based |
| AI analytics | **Yes** | School-level trend analysis |

---

## 6. Core AI Module Specifications

### 6.1 Academic Performance Prediction
**Purpose:** Forecast a student's future academic performance trajectory.
**Inputs:** Historical marks, attendance rate, homework submission rate, engagement observations.
**Output:** Predicted grade band for next assessment period + confidence score.
**Consumer:** Teacher portal, Admin analytics.
**AI Safety:** Output is a decision-support signal. Teachers must review and interpret.

### 6.2 Student Risk Prediction
**Purpose:** Identify students who may require additional academic or welfare support.
**Inputs:** Performance trend, attendance anomalies, mood check-in patterns, engagement signals, behavioral observations.
**Output:** Risk score (0–1), risk category (low/medium/high), contributing feature flags.
**Consumer:** Counselor portal, Admin AI analytics (aggregate only).
**AI Safety:** Risk score is NOT a diagnosis. It is a triage signal for counselor review. Full feature explanation must accompany any score.

> **Critical Distinction:**
> - Performance Prediction = "Where is the student academically heading?"
> - Risk Prediction = "Does the student need additional support?"
> These are separate models with different inputs, outputs, and consumers.

### 6.3 Well-being / Bullying NLP Detection
**Purpose:** Detect concerning language patterns in mood check-in free-text and anonymous safety report text.
**Inputs:** Free-text mood check-in notes, anonymous report text.
**Output:** Signal categories (distress, aggression, isolation, bullying), confidence score, severity flag.
**Consumer:** Counselor portal only.
**AI Safety:** Model outputs are signals, not clinical diagnoses. Must NOT be used as the sole basis for action.

### 6.4 Personalized Study Recommendation
**Purpose:** Generate a personalized study plan and resource recommendations for each student.
**Inputs:** Subject performance profile, learning gaps (inferred from exam results), available study materials.
**Output:** Ranked study topic recommendations, suggested materials.
**Consumer:** Student portal.

### 6.5 AI Study Assistant
**Purpose:** Answer student questions about their curriculum using school-provided study materials.
**Technology:** Gemini API + RAG (MongoDB Atlas Vector Search on study materials).
**Consumer:** Student portal.
**AI Safety:** Responses must cite source material. Must not provide answers that circumvent academic integrity.

### 6.6 AI Report Generation
**Purpose:** Generate draft narrative student reports for teacher review.
**Technology:** Gemini API, structured student data context.
**Consumer:** Teacher portal.
**AI Safety:** Output is a draft. Teacher must review, edit, and approve before distribution.

### 6.7 AI Notice Generation
**Purpose:** Draft school notices and communications.
**Technology:** Gemini API.
**Consumer:** Teacher and Admin portals.
**AI Safety:** Draft only. Human approval required.

### 6.8 AI Translation
**Purpose:** Translate communications into selected target languages.
**Technology:** Gemini API.
**Consumer:** Teacher and Admin portals.

### 6.9 AI Parent Assistant
**Purpose:** Allow parents to ask questions about their child's academic and attendance data in natural language.
**Technology:** Gemini API + RAG (scoped to parent's linked child data only).
**Consumer:** Parent portal.
**AI Safety:** Access is strictly scoped. Cannot access other students' data.

### 6.10 Bus Anomaly Detection
**Purpose:** Detect unusual GPS patterns in bus routes (unexpected stops, route deviations, extended idle time).
**Technology:** Rule-based baseline + ML anomaly detection on GPS event streams.
**Consumer:** Admin portal, Emergency management.
**AI Safety:** Anomaly flags trigger human review. No automated response.

### 6.11 Safety Hotspot Detection
**Purpose:** Identify physical locations with elevated frequency of safety incidents.
**Technology:** Geospatial clustering (DBSCAN or similar) on safety incident location data.
**Consumer:** Admin portal.
**Output:** Hotspot polygons with incident density visualization on Leaflet map.

---

## 7. External Services & Dependencies

| Service | Purpose | Notes |
|---------|---------|-------|
| MongoDB Atlas | Primary database | Vector Search for RAG |
| Gemini API | Generative AI (all LLM features) | API key server-side only |
| Python FastAPI ML Service | ML inference, training, anomaly detection | Internal service |
| Leaflet + OpenStreetMap | Maps (bus tracking, safety hotspots) | No Google Maps dependency |
| GPS Data Source | Bus location data | Hardware/IoT dependency (simulated in MVP) |
| Email/SMS Provider | Notifications and emergency alerts | Provider TBD (Twilio/SendGrid) |

---

## 8. Design Principles

1. **Data before AI** — Collect and structure data correctly before adding AI layers.
2. **Human in the loop** — Every AI output requires human review before consequential action.
3. **Least privilege access** — Every user sees the minimum data necessary for their role.
4. **Fail safe** — Emergency workflows (SOS, emergency alerts) must function without AI dependency.
5. **Transparency** — AI predictions must include rationale, confidence, and model version.
6. **Incremental delivery** — Build and verify each phase before proceeding to the next.
7. **No hallucinated features** — Do not claim or simulate AI functionality that does not exist.
