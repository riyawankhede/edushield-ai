# Implementation Roadmap
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## Overview

The project is divided into 20 phases. Each phase must be functionally complete and verified before the next phase begins.

The roadmap is ordered by dependency — each phase builds on the data structures and services from previous phases. **AI phases (10+) are explicitly sequenced after data collection phases (2–9)** because AI requires real data to be meaningful.

---

## Phase 1 — Architecture & Documentation ✅

**Goal:** Complete system design before writing any application code.

**Deliverables:**
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/SYSTEM_ARCHITECTURE.md`
- [x] `docs/DATABASE_DESIGN.md`
- [x] `docs/MONGODB_SCHEMA_DESIGN.md`
- [x] `docs/API_ARCHITECTURE.md`
- [x] `docs/AI_ARCHITECTURE.md`
- [x] `docs/SECURITY_MODEL.md`
- [x] `docs/AUTHORIZATION_MATRIX.md`
- [x] `docs/RAG_ARCHITECTURE.md`
- [x] `docs/ML_ARCHITECTURE.md`
- [x] `docs/IMPLEMENTATION_ROADMAP.md`
- [x] `AGENTS.md`

**Exit criteria:** All documents reviewed and approved before Phase 2 starts.

---

## Phase 2 — Data Layer (Mongoose Models)

**Goal:** Implement all Mongoose schemas and database connection infrastructure.

**Deliverables:**
- Next.js project initialized with TypeScript, App Router, Tailwind CSS, shadcn/ui
- MongoDB Atlas cluster connected
- All Mongoose models implemented per `MONGODB_SCHEMA_DESIGN.md`
- Database connection utility with connection pooling
- Seed data scripts for realistic test data
- Model unit tests (validation, constraints, indexes)

**Key tasks:**
- Initialize Next.js project: `npx create-next-app@latest ./ --typescript --tailwind --app --no-git`
- Configure MongoDB connection in `/lib/db.ts`
- Implement all models in `/models/` directory hierarchy
- Write seed scripts for: 1 school, 5 teachers, 2 counselors, 1 admin, 20 students, 10 parents
- Verify indexes exist in Atlas

**Exit criteria:** All models pass validation tests; seed data loads successfully; Atlas indexes confirmed.

---

## Phase 3 — Authentication & Authorization

**Goal:** Implement complete auth system with role-based access control.

**Deliverables:**
- JWT-based authentication (login, logout, refresh)
- httpOnly cookie session management
- Role middleware (`withAuth`, `withRole`)
- Resource ownership middleware
- Rate limiting on auth endpoints
- Audit logging infrastructure
- Auth API routes (`/api/v1/auth/*`)

**Key tasks:**
- Implement `UserService` (login, password hashing, refresh token)
- Implement JWT utilities in `/lib/jwt.ts`
- Implement Next.js middleware for edge auth
- Implement `withRole`, `withResourceOwnership` HOFs
- Implement `AuditLogService`
- API: POST /login, POST /logout, POST /refresh, GET /me

**Exit criteria:** All role combinations tested; unauthorized access returns 403; audit logs written.

---

## Phase 4 — Frontend Shell

**Goal:** Build the professional design system and portal navigation shells.

**Deliverables:**
- Design system tokens (colors, typography, spacing)
- Global layout components (Sidebar, Topbar, Breadcrumbs)
- Role-specific layouts (student, parent, teacher, counselor, admin)
- Authentication pages (login, change password)
- Empty portal shells (dashboards with no data yet)
- Responsive design
- Component library (Card, Table, Badge, Modal, Form elements)

**Key tasks:**
- Configure Tailwind theme with design system colors (navy/indigo primary)
- Install shadcn/ui components
- Create role-based route groups: `/(student)`, `/(parent)`, `/(teacher)`, `/(counselor)`, `/(admin)`
- Implement login page with form validation (React Hook Form + Zod)
- Build Sidebar navigation per role
- Dashboard shell with placeholder metric cards

**Design requirements:**
- Deep navy/indigo primary
- Clean, minimal, data-driven aesthetic
- Inter or Geist font
- Lucide icons
- No gradients, no emoji-heavy UI, no childish elements

**Exit criteria:** All 5 role dashboards render correctly; authentication flow works end-to-end; mobile-responsive.

---

## Phase 5 — Parent Portal

**Goal:** Implement complete parent portal with all listed features.

**Deliverables:**
- Parent dashboard (child summary metrics)
- Attendance view (calendar + statistics)
- Academic results (exam history, grade trends)
- Homework tracker (status overview)
- Exam results with Recharts grade chart
- Notices (school announcements)
- Teacher messaging (inbox/compose)
- School bus tracking (Leaflet map with bus location)
- Emergency alert display
- AI weekly summary (read-only view — generation deferred to Phase 10+)

**Key tasks:**
- `ParentService`, `AttendanceService`, `AcademicService`, `NotificationService`
- API routes: `/api/v1/students/:id/*` (parent-scoped)
- Recharts: grade trend line chart, attendance donut chart
- Leaflet bus map with polling
- Notification SSE stream

**Exit criteria:** Parent can log in and view linked child's full academic and attendance data; bus map renders; messages work.

---

## Phase 6 — Teacher Portal

**Goal:** Implement complete teacher portal with all listed features (AI features deferred).

**Deliverables:**
- Teacher dashboard (class overview)
- Student roster per class
- Attendance recording (bulk + individual)
- Marks entry per exam (bulk entry)
- Homework management (create, view, grade)
- Behavior observation entry
- AI features (read-only placeholders): performance prediction, risk flags
- AI report generation (placeholder — Gemini deferred to Phase 10)
- AI notice generation (placeholder)
- Notice creation (non-AI)

**Key tasks:**
- `TeacherService`, `HomeworkService`, `BehaviorObservationService`
- API routes: `/api/v1/attendance`, `/api/v1/exams`, `/api/v1/assignments`
- Bulk attendance form with one-click marking
- Marks entry table with validation
- Recharts: class performance distribution bar chart

**Exit criteria:** Teacher can record attendance, enter marks, assign homework; behavior observations save correctly.

---

## Phase 7 — Student Portal

**Goal:** Implement complete student portal with all listed features (AI features deferred).

**Deliverables:**
- Student dashboard (personal summary)
- Homework view (pending, submitted, graded)
- Study materials browser (filter by subject/grade)
- Mood check-in (daily form)
- Anonymous safety/bullying report submission
- Student SOS button (emergency escalation — no AI)
- Bus information (own route and stops)
- Notices

**Key tasks:**
- `MoodCheckinService`, `SafetyReportService`
- API routes: `/api/v1/mood-checkins`, `/api/v1/safety/reports`, `/api/v1/safety/sos`
- Anonymous report: strip identity before storage
- SOS: immediate notification to counselor and admin (no AI)
- Bus info: display assigned route and today's schedule

**Exit criteria:** Student can submit mood check-in; anonymous report stores without identity; SOS triggers notifications to staff.

---

## Phase 8 — Counselor Portal

**Goal:** Implement complete counselor portal.

**Deliverables:**
- Counselor dashboard (well-being overview metrics)
- Well-being cases view (mood trends per student, NLP signal placeholders)
- Safety reports management (list, assign, update status)
- Risk insights view (placeholder — ML deferred to Phase 11)
- Intervention management (create/track interventions)

**Key tasks:**
- `CounselorService`, `InterventionService`
- API routes: `/api/v1/wellbeing/*`, `/api/v1/safety/reports/*`
- Well-being timeline (Recharts) per student
- Safety report workflow (assign → review → resolve)
- `Intervention` model (not in initial schema — add now)

**Exit criteria:** Counselor can view all safety reports; mood timeline renders; intervention records save.

---

## Phase 9 — Admin Portal

**Goal:** Implement complete admin portal (AI analytics deferred).

**Deliverables:**
- Admin dashboard (school-wide summary)
- Student and teacher management (CRUD)
- School analytics (Recharts: enrollment trends, attendance rates)
- Safety reports (aggregated view)
- Emergency alert management (create/broadcast/resolve)
- Bus management (fleet + routes)
- Visitor management (check-in/check-out)
- Digital gate passes (create, QR generation, verification)
- Audit log viewer

**Key tasks:**
- `AdminService`, `TransportService`, `VisitorService`, `GatePassService`
- Emergency alert broadcast → SSE stream to all connected clients
- QR code generation for gate passes
- Recharts: multi-metric school analytics dashboard

**Exit criteria:** Admin can perform full CRUD; emergency alert broadcasts to all sessions; gate pass QR verifies correctly.

---

## Phase 10 — Academic Performance Prediction

**Goal:** Implement ML service + performance prediction pipeline.

**Deliverables:**
- Python FastAPI ML service scaffold
- Performance prediction model (XGBoost) + training script
- Feature engineering pipeline
- Seed training data (synthetic realistic data)
- `/predict/performance` ML service endpoint
- `AIOrchestrationService` in Next.js
- Teacher portal: performance prediction view with confidence indicator
- Admin analytics: class prediction distribution
- AI output storage in `ai_predictions` collection
- Model version registration

**Exit criteria:** ML service returns predictions; predictions stored with metadata; teacher can view predictions with review workflow.

---

## Phase 11 — Student Risk Prediction

**Goal:** Implement risk scoring pipeline.

**Deliverables:**
- Risk prediction model (XGBoost + SHAP) + training script
- `/predict/risk` ML service endpoint
- Risk score display in counselor portal (with contributing factors)
- Aggregate risk view in admin portal (no individual detail)
- Risk score review workflow for counselors
- Scheduled batch risk scoring (all active students, weekly)

**Exit criteria:** Risk scores generate for all students; counselor can view scores with SHAP factors; admin sees aggregate distribution only.

---

## Phase 12 — Well-being & Bullying NLP

**Goal:** Implement NLP analysis of mood check-in text and safety reports.

**Deliverables:**
- NLP classification model (distilBERT or similar) + fine-tuning script
- `/analyze/wellbeing` ML service endpoint
- Event-driven trigger: NLP analysis on mood check-in submission
- `WellbeingSignal` records created from NLP output
- Counselor portal: NLP signal display with confidence indicators
- Well-being review workflow
- NLP analysis of anonymous safety reports

**Exit criteria:** NLP processes new mood check-ins within 60 seconds; signals appear in counselor portal; review workflow functions.

---

## Phase 13 — Study Recommendation

**Goal:** Implement personalized study plan recommendations.

**Deliverables:**
- Study recommendation model (content-based filter) + training/inference
- `/recommend/study` ML service endpoint
- Study materials properly tagged and indexed
- Student portal: personalized study plan view
- Weekly recommendation generation

**Exit criteria:** Student receives study recommendations ranked by subject weakness; recommended materials are accessible.

---

## Phase 14 — Gemini AI Study Assistant

**Goal:** Implement AI Study Assistant with Gemini (no RAG yet).

**Deliverables:**
- `GeminiService` with proper system instructions
- `StudyAssistantService`
- Student portal: chat interface
- Conversation history storage in `ai_interactions`
- Rate limiting on chat endpoint
- AI disclaimer displayed in UI

**Exit criteria:** Student can chat with assistant; responses reference study topics; conversation history persists.

---

## Phase 15 — RAG Integration

**Goal:** Add MongoDB Atlas Vector Search RAG to Study Assistant and Parent Assistant.

**Deliverables:**
- Study material chunking pipeline
- `study_material_chunks` collection
- Atlas Vector Search index configured
- `RAGService` with embedding generation and retrieval
- Study Assistant upgraded with vector retrieval
- Parent Assistant implemented with structured RAG
- Source citations in responses
- AI Weekly Summary generation (Gemini)

**Exit criteria:** Study Assistant responses cite specific study materials; Parent Assistant answers scoped to child data only.

---

## Phase 16 — Bus Anomaly Detection

**Goal:** Implement bus GPS anomaly detection.

**Deliverables:**
- GPS event ingestion endpoint (device auth)
- Bus anomaly model (Isolation Forest + rule-based)
- `/detect/bus-anomaly` ML service endpoint
- Real-time anomaly flags in admin portal
- Anomaly alert notifications
- Bus anomaly review workflow

**Exit criteria:** Anomalies detected from GPS simulation; admin receives anomaly alerts; review workflow functions.

---

## Phase 17 — Safety Hotspot Detection

**Goal:** Implement geospatial safety hotspot clustering.

**Deliverables:**
- `/detect/safety-hotspots` ML service endpoint (DBSCAN)
- Admin portal: Leaflet map with hotspot overlays
- Scheduled weekly hotspot analysis
- Hotspot severity classification

**Exit criteria:** Hotspots detected from seed incident data; displayed on Leaflet map with severity coloring.

---

## Phase 18 — Full System Integration

**Goal:** Ensure all components work together end-to-end.

**Deliverables:**
- Full end-to-end data flow testing
- Cross-portal workflows verified (e.g., student submits report → counselor receives alert → counselor reviews)
- AI weekly summary generation tested
- Notification delivery verified across all roles
- Performance testing (response times under load)

---

## Phase 19 — Testing & Security

**Goal:** Comprehensive testing and security hardening.

**Deliverables:**
- Unit tests: all services
- Integration tests: all API routes
- Authorization tests: verify role boundaries hold
- Security audit: OWASP Top 10 review
- Penetration testing: anonymous report identity protection verified
- Rate limiting verified
- Load testing

---

## Phase 20 — Production & Demo Polish

**Goal:** Production-ready deployment and demo environment.

**Deliverables:**
- Production environment configuration
- CI/CD pipeline
- Demo data seed with realistic school scenario
- Performance optimization
- Documentation updates
- User onboarding flows

---

## Dependency Graph

```
Phase 1 (Architecture)
    ↓
Phase 2 (Data Layer)
    ↓
Phase 3 (Auth)
    ↓
Phase 4 (Frontend Shell)
    ↓
Phase 5 (Parent) ─── Phase 6 (Teacher) ─── Phase 7 (Student) ─── Phase 8 (Counselor) ─── Phase 9 (Admin)
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                                            ↓
                                    Phase 10 (Performance ML)
                                            ↓
                                    Phase 11 (Risk ML)
                                            ↓
                                    Phase 12 (NLP Well-being)
                                            ↓
                                    Phase 13 (Study Recommendation)
                                            ↓
                                    Phase 14 (Gemini Assistant)
                                            ↓
                                    Phase 15 (RAG)
                                            │
                              ┌─────────────┤
                              ↓             ↓
                     Phase 16 (Bus)   Phase 17 (Hotspots)
                              └─────────────┘
                                            ↓
                                    Phase 18 (Integration)
                                            ↓
                                    Phase 19 (Testing)
                                            ↓
                                    Phase 20 (Production)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Insufficient training data for ML models | High | High | Use synthetic data for initial MVP; real data improves model over time |
| NLP model accuracy for multilingual content | Medium | High | Select multilingual model from start; test with representative data |
| GPS hardware integration complexity | Medium | Medium | Simulate GPS in MVP; production hardware integrated post-MVP |
| Atlas Vector Search index cost | Low | Low | M10+ cluster required; budget accordingly |
| Gemini API rate limits | Medium | Medium | Rate limit users; cache repeated similar queries |
| Anonymous report anonymization breach | Low | Critical | Multiple layers: no storage + serializer strip + access control |
| ML model bias against specific student groups | Medium | High | Regular bias evaluation; require diverse training data |
| Phase scope creep (adding features mid-phase) | High | Medium | Strict phase exit criteria; defer additions to next phase |
