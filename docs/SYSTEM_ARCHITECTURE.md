# System Architecture
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. Architecture Overview

The system uses a layered, service-oriented architecture built around a Next.js full-stack application with a dedicated Python ML service. The architecture deliberately avoids unnecessary microservice decomposition for MVP while maintaining clear service boundaries for future scaling.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER CLIENT                          │
│              Next.js App Router (React / TypeScript)            │
│         Role-scoped portals: Student, Parent, Teacher,          │
│                   Counselor, Admin                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION SERVER                   │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  App Router     │  │  API Routes      │  │  Middleware   │  │
│  │  (Page layers)  │  │  /api/**         │  │  Auth + RBAC  │  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   SERVICE LAYER                          │  │
│  │  StudentService  AttendanceService  AcademicService      │  │
│  │  SafetyService   TransportService  NotificationService   │  │
│  │  HomeworkService CounselorService  AdminService          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   DATA ACCESS LAYER                      │  │
│  │            Mongoose Models / MongoDB Queries             │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────┬──────────────────────────────┬──────────────────────┘
            │ Mongoose/MongoDB Driver       │ Internal HTTP
            ▼                               ▼
┌───────────────────────┐    ┌──────────────────────────────────┐
│    MongoDB Atlas      │    │    Python FastAPI ML Service      │
│                       │    │                                  │
│  Collections:         │    │  ┌─────────────────────────────┐ │
│  - users              │    │  │  Endpoints:                 │ │
│  - students           │    │  │  POST /predict/performance  │ │
│  - attendance_records │    │  │  POST /predict/risk         │ │
│  - exam_results       │    │  │  POST /analyze/wellbeing    │ │
│  - mood_checkins      │    │  │  POST /recommend/study      │ │
│  - safety_reports     │    │  │  POST /detect/bus-anomaly   │ │
│  - gps_events         │    │  │  POST /detect/hotspots      │ │
│  - ...                │    │  └─────────────────────────────┘ │
│                       │    │                                  │
│  Vector Search:       │    │  ML Stack:                       │
│  - study_materials    │    │  - scikit-learn / XGBoost        │
│  - ai_interactions    │    │  - pandas / numpy                │
│                       │    │  - NLP libraries                 │
└───────────────────────┘    └──────────┬─────────────────────────┘
                                        │
                                        ▼
                             ┌──────────────────────┐
                             │    Gemini API         │
                             │  (Google Cloud)       │
                             │                       │
                             │  - Text generation    │
                             │  - Embeddings         │
                             │  - Translation        │
                             └──────────────────────┘
```

---

## 2. Application Layers

### 2.1 Presentation Layer (Next.js App Router)

- Role-scoped route groups: `(student)`, `(parent)`, `(teacher)`, `(counselor)`, `(admin)`
- Server Components for data fetching (SSR)
- Client Components for interactive UI (charts, forms, real-time updates)
- Middleware enforces authentication and role routing at the edge
- No database logic, no AI logic inside React components

### 2.2 API Layer (Next.js API Routes)

- All data mutations and reads go through typed API route handlers
- Every route is protected by authentication and role/resource authorization middleware
- API routes call Service Layer functions — they do not contain business logic themselves
- API routes forward ML inference requests to the Python service (server-side only)

### 2.3 Service Layer (TypeScript)

Business logic lives in the service layer. Services are pure TypeScript modules:

| Service | Responsibility |
|---------|---------------|
| `StudentService` | Student profile CRUD, enrollment queries |
| `AttendanceService` | Record, query, and summarize attendance |
| `AcademicService` | Exam results, marks, grade calculations |
| `HomeworkService` | Assignment lifecycle management |
| `SafetyService` | Safety report intake, anonymization, workflow |
| `WellbeingService` | Mood check-ins, well-being signal aggregation |
| `TransportService` | Bus routes, GPS event ingestion, tracking |
| `NotificationService` | Notices, messages, push/email dispatch |
| `CounselorService` | Intervention management, risk case workflow |
| `AdminService` | School-level management, audit logs |
| `AIOrchestrationService` | Coordinate ML service calls, store predictions |
| `GeminiService` | Gemini API client (all generative AI calls) |
| `RAGService` | Vector search queries, context assembly for RAG |

### 2.4 Data Access Layer (Mongoose)

- All MongoDB operations go through Mongoose models
- No raw MongoDB queries in service or API layer — use Mongoose model methods
- Indexes, validation, and timestamps defined at schema level
- Pagination enforced on all list queries

### 2.5 ML Service (Python / FastAPI)

- Separate deployable service (separate Docker container in production)
- Communicates with Next.js backend over authenticated internal HTTP
- Responsible for: model training, preprocessing, inference, versioning
- Does NOT have direct database access in production (data passed via API payload or batch job)
- In development: can connect to MongoDB for batch training data extraction

---

## 3. Authentication Architecture

### Flow

```
Browser
  → POST /api/auth/login (credentials)
  → Next.js API Route
  → Validate credentials against users collection
  → Issue JWT (httpOnly cookie) + session
  → Middleware verifies JWT on every subsequent request
  → Role extracted from JWT claims
  → Resource ownership checked in service layer
```

### JWT Claims

```json
{
  "sub": "userId",
  "role": "teacher",
  "schoolId": "schoolId",
  "linkedStudentIds": ["s1", "s2"],   // parents only
  "classIds": ["c1", "c2"],           // teachers only
  "exp": 1234567890
}
```

### Session Management

- JWT stored in httpOnly, Secure, SameSite=Strict cookie
- Short-lived access token (15 min) + refresh token (7 days)
- Refresh token rotation on every use
- Logout invalidates refresh token server-side (stored in DB)

---

## 4. Authorization Model (Summary)

Full details in `AUTHORIZATION_MATRIX.md`.

### Principle: Defense in Depth

1. **Middleware** — Verifies JWT validity and role routing
2. **API Route** — Confirms role is permitted to call this endpoint
3. **Service Layer** — Verifies resource ownership (e.g., student is in teacher's class)
4. **Database** — Scoped queries (always include `schoolId`, `classId`, `studentId` filters)

### Role Capabilities (High Level)

| Role | Own Data | Child Data | Class Data | School Data | Well-being | Safety |
|------|----------|------------|------------|-------------|-----------|--------|
| Student | ✅ | ❌ | ❌ | ❌ | Own only | Submit only |
| Parent | ❌ | ✅ Linked | ❌ | ❌ | ❌ | ❌ |
| Teacher | ❌ | ❌ | ✅ Assigned | ❌ | ⚠️ Risk flag only | ❌ |
| Counselor | ❌ | ❌ | ❌ | ⚠️ Well-being | ✅ | ✅ |
| Admin | ❌ | ❌ | ❌ | ✅ | ⚠️ Aggregate | ✅ |

---

## 5. Real-time Architecture

For MVP, real-time features are limited to:

- **Bus tracking:** Polling-based (client polls `/api/transport/bus/:busId/location` every 10s)
- **Emergency alerts:** Server-Sent Events (SSE) on `/api/alerts/stream`
- **Notifications:** Server-Sent Events or polling

Full WebSocket infrastructure is deferred to Phase 2.

---

## 6. File Storage

- Study materials (PDFs, slides) stored in cloud object storage (e.g., AWS S3 or GCS)
- File URLs stored in MongoDB; files never served directly through Next.js
- Access requires signed URLs generated server-side with role check

---

## 7. Deployment Architecture (Target)

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Platform                        │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐  │
│  │  Next.js App      │    │  Python ML Service       │  │
│  │  (Vercel / GCP)   │◄──►│  (Cloud Run / Render)   │  │
│  └──────────────────┘    └──────────────────────────┘  │
│           │                          │                  │
│           └──────────┬───────────────┘                  │
│                      ▼                                  │
│          ┌──────────────────────┐                       │
│          │   MongoDB Atlas      │                       │
│          │   (M10+ cluster)     │                       │
│          └──────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Environment Configuration

All secrets managed via environment variables. Never committed to version control.

```
# Application
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# MongoDB
MONGODB_URI=

# ML Service
ML_SERVICE_URL=
ML_SERVICE_API_KEY=

# Gemini
GEMINI_API_KEY=

# File Storage
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# Notifications
EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=
```

---

## 9. Key Architectural Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js App Router | Full-stack TypeScript, SSR, API routes, edge middleware in one deployment |
| Database | MongoDB Atlas | Document model suits varied student data; Vector Search enables RAG |
| ML Service | Separate FastAPI | Python ML ecosystem (scikit-learn, XGBoost) cannot run in Next.js; clear service boundary |
| Auth | JWT + httpOnly cookie | Industry standard; avoids localStorage XSS exposure |
| Maps | Leaflet + OSM | No Google Maps API cost; sufficient for school bus tracking |
| LLM | Gemini API | Single LLM provider simplifies integration and cost management |
| No Express | Next.js API routes | Avoids unnecessary server complexity for MVP scale |
| No microservices | Monolith + ML service | Avoids premature complexity; ML service is the only justified separation |
