# AGENTS.md
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**This file governs all AI agents, code generation tools, and developers working on this codebase.**

Read this file before writing any code. All rules below are mandatory.

---

## Table of Contents

1. [Architecture Rules](#1-architecture-rules)
2. [Coding Standards](#2-coding-standards)
3. [MongoDB & Mongoose Rules](#3-mongodb--mongoose-rules)
4. [Security Rules](#4-security-rules)
5. [AI Safety Rules](#5-ai-safety-rules)
6. [Frontend Design Rules](#6-frontend-design-rules)
7. [Testing Requirements](#7-testing-requirements)
8. [Naming Conventions](#8-naming-conventions)
9. [Environment Variable Rules](#9-environment-variable-rules)
10. [Git & Version Control Rules](#10-git--version-control-rules)

---

## 1. Architecture Rules

### Layer Separation — Non-negotiable

```
✅ CORRECT flow:
  API Route Handler → Service → Mongoose Model → MongoDB

❌ NEVER:
  React Component → MongoDB (direct)
  API Route → MongoDB (bypassing service)
  React Component → Gemini API (direct)
  Service → Gemini API (must go through GeminiService)
  ML Model code in Next.js application
```

### Service Boundaries

- `GeminiService` is the **only** place where `GoogleGenerativeAI` is instantiated
- `RAGService` is the **only** place where Atlas Vector Search is called
- `AIOrchestrationService` is the **only** place where the ML service HTTP client is called
- Every database entity type has a corresponding Service class
- Services are pure TypeScript modules with no React imports

### No Microservices Proliferation

- The only two deployed services are: **Next.js application** and **Python ML service**
- Do NOT introduce additional services, message queues, or caching layers without explicit approval
- Redis is not in the current stack — do not add it without architectural discussion

### ML Service Rules

- The Python ML service does NOT have direct MongoDB access in production
- All inference requests come with the necessary feature data in the request body
- The ML service does NOT call Gemini API — that is the application server's responsibility
- Training scripts may connect to MongoDB for data extraction, but they are run offline

### Next.js Specific

- Use **App Router** exclusively — no Pages Router patterns
- Use **Server Components** for data fetching where possible
- Use **Client Components** (`'use client'`) only when interactivity requires it
- All API calls from the client go through Next.js API routes — never directly to external services
- Middleware (edge) handles JWT verification — API routes get pre-verified user context

---

## 2. Coding Standards

### TypeScript

- **Strict TypeScript everywhere** — `strict: true` in `tsconfig.json`
- No `any` types unless explicitly justified with a comment
- All function parameters and return types must be explicitly typed
- Use Zod for runtime validation; infer TypeScript types from Zod schemas where possible
- All API request/response types defined in `/types/api.ts` or domain-specific type files

### File Organization

```
/app                    # Next.js App Router pages and layouts
/components             # Reusable UI components
  /ui                   # Primitive components (shadcn/ui extensions)
  /[feature]            # Feature-specific components
/features               # Feature modules (self-contained)
  /[feature-name]
    /components         # Feature UI components
    /hooks              # Feature React hooks
    /types.ts           # Feature-specific types
/lib                    # Utilities and infrastructure
  /db.ts                # MongoDB connection
  /jwt.ts               # JWT utilities
  /gemini.ts            # GeminiService
  /rag.ts               # RAGService
  /ml-client.ts         # ML service HTTP client
/models                 # Mongoose models (organized by domain)
/services               # Business logic services
/hooks                  # Shared React hooks
/types                  # Global TypeScript types
/validators             # Zod schemas (input validation)
/config                 # Application configuration
```

### Error Handling

- Every API route must have a try/catch
- Never return raw MongoDB errors or stack traces to the client
- Use a centralized `APIError` class with error codes matching the API specification
- Log errors server-side (with sufficient context) before returning sanitized error responses
- ML service unavailability must return `AI_SERVICE_ERROR` — it must NOT crash the application

```typescript
// Standard API error handler
import { NextResponse } from 'next/server';

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json({ success: false, error: error.toJSON() }, { status: error.httpStatus });
  }
  console.error('[API Error]', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    { status: 500 }
  );
}
```

### Async/Await

- Use `async/await` — no raw `.then()/.catch()` chains
- Use `Promise.all()` for parallel independent database queries
- Never `await` inside a loop — batch queries instead

---

## 3. MongoDB & Mongoose Rules

### Schema Rules

1. **Every schema must have `timestamps: true`** (except event-only collections like `gps_events` and `audit_logs`)
2. **`schoolId` is required on every collection** — no exceptions
3. **`select: false`** must be set on: `passwordHash`, `refreshTokenHash`, `notes` (mood_checkins), `embedding` (study_materials)
4. **Enum constraints** on all categorical string fields — no free-form strings for status/type fields
5. **`maxlength`** validation on all user-input text fields (prevent abuse)
6. **GeoJSON format** for all geospatial fields: `{ type: 'Point', coordinates: [lng, lat] }`

### Query Rules

1. **Always include `schoolId` filter** in every query — never fetch documents without scoping to school
2. **Always paginate list queries** — never use `.find()` without `.limit()` and `.skip()` or cursor
3. **Use `.lean()` for read-only queries** that don't need Mongoose document methods (performance)
4. **Never `populate()` deeply nested** — max 2 levels; prefer manual lookup for complex joins
5. **Use projection** to select only required fields — never return full documents unnecessarily

```typescript
// ✅ CORRECT: scoped, paginated, lean
const results = await ExamResult.find(
  { studentId, schoolId, examId: { $in: examIds } },
  { marksObtained: 1, grade: 1, isPassed: 1 }  // projection
)
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(pageSize)
  .lean();

// ❌ WRONG: no scope, no pagination
const results = await ExamResult.find({ studentId });
```

### Indexing Rules

1. All compound indexes must be defined in the schema `index()` call — not ad-hoc
2. Geospatial fields must have `2dsphere` index
3. `gps_events.timestamp` must have a TTL index (90 days)
4. Atlas Vector Search index must be created manually in Atlas dashboard and documented

### Embedding vs Referencing

- **Embed** bus stops in bus routes (bounded, always accessed together)
- **Embed** NLP signal summary in safety reports (small, not independently queried)
- **Embed** input features summary in ai_predictions (immutable snapshot)
- **Reference** everything else — do NOT embed growing arrays or independently queried entities
- **Never embed** GPS events, attendance records, exam results, or mood check-ins into student documents

### Data Mutation Rules

1. **Soft delete only** — set `isActive: false`, never hard delete student/teacher/class records
2. **Audit log EVERY mutation** to sensitive resources (see security rules)
3. **`audit_logs` collection is immutable** — the Mongoose model must reject all updates and deletes via pre-hooks

---

## 4. Security Rules

### Authentication & Authorization

1. **Every API route is authenticated** — no route skips `withAuth()` except the login endpoint
2. **Role check alone is not sufficient** — resource ownership must also be verified
3. **Never trust client-supplied IDs without verification** — always re-fetch and verify ownership in service layer
4. **JWT is server-signed** — role cannot be modified by the client

### Sensitive Data Rules

1. **Anonymous report identity MUST NEVER be returned** — enforced at the serializer, not just query level
2. **Mood check-in `notes` field** — excluded from all queries except counselor-scoped endpoints
3. **Risk scores** — never returned to teachers or parents — only counselors and admin
4. **Well-being signals** — counselors and admin only
5. **Password hashes** — `select: false` in schema; never returned in any query
6. **API keys** — never logged, never returned in API responses

### Input Validation

1. **All API inputs validated with Zod** before reaching service layer
2. **MongoDB ObjectId inputs** validated against regex `^[0-9a-fA-F]{24}$`
3. **Free text inputs** have `maxlength` enforced at Zod + Mongoose level
4. **File uploads** validated for type (whitelist) and size before storage

### Audit Logging

1. **Audit log EVERY** login, logout, failed login
2. **Audit log EVERY** create/update/delete on student, teacher, exam_result, safety_report, risk_score, wellbeing_signal
3. **Audit log EVERY** AI prediction generation
4. **Audit log EVERY** access to risk scores, wellbeing signals, mood check-in notes
5. **Audit log READS** of sensitive resources (not just writes)

### Cookie / CORS

1. All auth cookies: `httpOnly: true`, `secure: true`, `sameSite: 'strict'`
2. CORS configured to allow only the application origin
3. ML service not accessible from public internet

---

## 5. AI Safety Rules

### No Automated High-Impact Decisions

**AI outputs MUST NOT:**
- Automatically create formal student records
- Automatically trigger disciplinary actions
- Automatically contact parents without human approval
- Automatically diagnose mental health conditions
- Automatically resolve safety reports

**AI outputs MUST:**
- Be stored with model name, version, confidence, and timestamp
- Have a `reviewStatus` field defaulting to `'unreviewed'`
- Be accompanied by a human review workflow in the UI
- Include a visible disclaimer in the frontend UI

### AI Output Metadata — Mandatory Fields

Every AI output stored in the database MUST include:

```typescript
{
  modelName: string;          // e.g., "xgboost_performance_v1"
  modelVersion: string;       // e.g., "20260101_1200"
  confidence?: number;        // 0-1 where applicable
  generatedAt: Date;          // when the prediction was made
  reviewStatus: 'unreviewed' | 'accepted' | 'noted' | 'rejected';
}
```

Omitting any of these fields is a blocker — the AI feature is incomplete.

### NLP Well-being Analysis

- NLP model outputs are signals, NOT diagnoses
- The UI must display: "This is an AI-detected signal, not a clinical assessment."
- Every well-being signal with `severity: 'high'` must set `requiresCounselorReview: true`
- Counselors must acknowledge signals before they are marked as reviewed

### Gemini API Rules

- **API key is server-side only** — `process.env.GEMINI_API_KEY`, never `NEXT_PUBLIC_*`
- **System instructions are mandatory** for every Gemini call — no unconstrained generation
- **Context is scoped** — Gemini must never receive data from outside the requesting user's authorized scope
- **Student identifiers** in Gemini prompts: use first name only, never student ID or full name + ID combination
- **Generated content is a draft** — report and notice generation always requires human approval

### Emergency Workflows

- **SOS button** does not call AI — it directly notifies counselor and admin
- **Emergency alerts** are created by admin directly — no AI dependency
- **Bus anomaly alerts** notify admins, who then decide on response — no automated response

### Hallucination Prevention

- **Structured data passed as context** — Gemini is never asked to infer student data from memory
- **RAG responses cite sources** — if no relevant material found, say so explicitly
- **Parent Assistant** uses only data fetched from the database for the specific child — never inferred data

---

## 6. Frontend Design Rules

### Design System

**Primary color:** Deep navy / indigo (`#1E2D5A` or equivalent)
**Neutral palette:** White, Slate-50 through Slate-900
**Semantic colors:**
- Green: healthy, low risk, positive
- Amber: attention required, medium risk
- Red: critical, high risk, error
- Blue: informational, in progress

**Font:** Inter or Geist (via `next/font`)
**Icons:** Lucide React exclusively
**Charts:** Recharts exclusively
**Maps:** Leaflet + OpenStreetMap exclusively

### DO NOT:

- Use gradients as decorative backgrounds
- Use emoji as UI elements or status indicators
- Use rounded corners > `rounded-lg` on primary cards
- Create "AI dashboard" purple aesthetics
- Use placeholder images — generate real images or use structured data visualizations
- Add animations that serve no functional purpose
- Use generic Bootstrap or Material Design patterns

### DO:

- Use semantic HTML elements (`<nav>`, `<main>`, `<section>`, `<article>`)
- Ensure every interactive element has a unique, descriptive `id` attribute
- Ensure all forms are accessible (labels, ARIA, keyboard navigation)
- Use consistent spacing from the Tailwind scale
- Make all tables sortable and filterable where appropriate
- Implement skeleton loading states for data-fetching components
- Use `role="status"` and `aria-live` for dynamic content updates

### Component Patterns

```typescript
// ✅ Data display pattern
function StudentGradeCard({ studentId }: { studentId: string }) {
  // Data fetched in Server Component or via SWR/TanStack Query
  // No inline API calls or mongoose queries
}

// ✅ AI result display pattern — always show disclaimer
function AIRiskScore({ riskScore }: { riskScore: RiskScore }) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        AI-generated assessment — requires counselor review
      </p>
      {/* score display */}
    </div>
  );
}
```

---

## 7. Testing Requirements

### Minimum Testing Requirements

All services must have unit tests before the phase is considered complete.

#### Unit Tests (Jest)
- All service methods — happy path + error cases
- Zod validators — valid and invalid inputs
- JWT utilities — token generation and verification
- Authorization scope functions

#### Integration Tests (Jest + Mongoose in-memory)
- All API routes — per role, per allowed/denied combination
- Authentication flow end-to-end
- Critical security boundaries:
  - Anonymous report identity not returned
  - Risk scores not accessible to teachers
  - Student can only access own data
  - Parent can only access linked child's data

#### Test Naming Convention

```typescript
describe('AttendanceService', () => {
  describe('recordAttendance', () => {
    it('should record attendance when teacher is assigned to class', async () => { ... });
    it('should throw ForbiddenError when teacher is not assigned to class', async () => { ... });
    it('should throw ValidationError when date is in the future', async () => { ... });
  });
});
```

### Test Data

- Use realistic synthetic seed data — not `user1`, `test123`, placeholder strings
- Seed scripts in `/scripts/seed/` directory
- Seed data must exercise security boundaries (e.g., teachers assigned to specific classes, parents linked to specific students)

---

## 8. Naming Conventions

### Files & Directories

| Item | Convention | Example |
|------|-----------|---------|
| Next.js pages | `page.tsx` | `app/(teacher)/dashboard/page.tsx` |
| Next.js layouts | `layout.tsx` | `app/(teacher)/layout.tsx` |
| React components | PascalCase | `StudentGradeChart.tsx` |
| Services | PascalCase + Service suffix | `AttendanceService.ts` |
| Mongoose models | PascalCase singular | `ExamResult.ts` |
| API routes | `route.ts` | `app/api/v1/attendance/route.ts` |
| Hooks | camelCase + use prefix | `useStudentProfile.ts` |
| Validators | camelCase + Schema suffix | `createAttendanceSchema.ts` |
| Types | PascalCase with DTO suffix for API types | `StudentProfileDTO.ts` |
| Utility files | camelCase | `dateUtils.ts`, `formatGrade.ts` |

### Code

| Item | Convention | Example |
|------|-----------|---------|
| Variables | camelCase | `studentId`, `attendanceRate` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE`, `JWT_EXPIRY` |
| TypeScript interfaces | PascalCase + I prefix (optional) | `StudentProfile` or `IStudentProfile` |
| TypeScript enums | PascalCase | `AttendanceStatus`, `UserRole` |
| Mongoose collection names | plural snake_case (set via `collection` option) | `attendance_records` |
| MongoDB field names | camelCase | `studentId`, `createdAt` |

### API Routes

- RESTful, plural nouns: `/api/v1/students`, `/api/v1/exam-results`
- Kebab-case for multi-word paths: `/api/v1/leave-requests`, `/api/v1/gate-passes`
- Action endpoints (verbs): `/api/v1/safety/sos`, `/api/v1/auth/refresh`

---

## 9. Environment Variable Rules

### Mandatory Rules

1. **NEVER commit `.env` files** — `.env` is in `.gitignore`
2. **ALWAYS commit `.env.example`** with placeholder values and comments
3. **NEXT_PUBLIC_ prefix** is ONLY for variables that are intentionally client-accessible (e.g., app name, school name)
4. **NEVER use NEXT_PUBLIC_ for any API key, database URI, or secret**
5. **All secrets accessed server-side** — in API routes, server components, and services only

### Required Environment Variables

```bash
# .env.example

# Application
NEXTAUTH_SECRET=your-secret-here-minimum-32-chars
NEXTAUTH_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname

# Gemini AI (SERVER SIDE ONLY — NEVER NEXT_PUBLIC_)
GEMINI_API_KEY=your-gemini-api-key

# ML Service (SERVER SIDE ONLY)
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_API_KEY=your-ml-service-api-key

# File Storage
STORAGE_BUCKET=your-bucket-name
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_REGION=us-east-1

# Notification Services (optional for MVP)
EMAIL_API_KEY=
SMS_API_KEY=

# Application Config (CAN be NEXT_PUBLIC_ if needed client-side)
NEXT_PUBLIC_SCHOOL_NAME=Demo School
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### Variable Validation at Startup

```typescript
// lib/config.ts — validates required env vars at application startup
const requiredEnvVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'MONGODB_URI',
  'GEMINI_API_KEY',
  'ML_SERVICE_URL',
  'ML_SERVICE_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

---

## 10. Git & Version Control Rules

### Branch Strategy

```
main              # Production branch — protected
develop           # Integration branch — all features merge here
feature/*         # Feature branches (e.g., feature/phase-5-parent-portal)
fix/*             # Bug fix branches
```

### Commit Messages

Follow Conventional Commits:

```
feat(parent-portal): add attendance view with calendar component
fix(auth): resolve refresh token rotation not clearing old hash
docs(agents): add MongoDB query rules
test(attendance): add authorization boundary tests
chore(deps): update next.js to 14.x
```

### What NOT to Commit

```
.env                  # Secrets
*.local               # Local config
/node_modules         # Dependencies
/ml-service/artifacts # Model artifacts (too large — use model registry)
*.pkl                 # Python model files
.DS_Store             # OS metadata
```

### Pull Request Requirements

- All PRs must pass: TypeScript compilation, linting, tests
- Security-related changes require review by at least one additional developer
- AI feature PRs must include: model version documented, AI disclaimer verified in UI, review workflow implemented

---

## Quick Reference: What Requires AI vs What Doesn't

### Use AI (Gemini or ML)

- Performance predictions
- Risk scores
- NLP well-being signal detection
- Study recommendations
- AI Study Assistant (Gemini)
- AI Parent Assistant (Gemini)
- AI Report generation (Gemini)
- AI Notice generation (Gemini)
- AI Translation (Gemini)
- AI Weekly Summary (Gemini)
- Bus anomaly detection
- Safety hotspot detection

### Do NOT Use AI (build as data features)

- Attendance recording
- Mark entry
- Homework assignment
- Student profile management
- School bus scheduling
- Visitor management
- Gate passes
- Emergency alerts (SOS, broadcast)
- Safety report submission
- Mood check-in data entry
- Notices (non-AI generated)
- School analytics (Recharts on real data)
- Authorization and authentication
- Audit logging

---

*This document is the authoritative reference for all code generation, agent behavior, and development decisions on this project. When in doubt, read this file first.*

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
