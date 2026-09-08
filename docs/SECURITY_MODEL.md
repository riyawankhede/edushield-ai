# Security Model
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. Security Philosophy

This platform stores sensitive personal data about minors. Security is not an optional layer — it is a first-class design requirement.

**Core principles:**
1. **Defense in depth** — Multiple independent security layers
2. **Least privilege** — Users access only what is strictly necessary
3. **Server-side enforcement** — Authorization is never delegated to the frontend
4. **Data minimization** — Do not collect, return, or log more data than necessary
5. **Auditability** — Every access to sensitive data is logged
6. **Secure by default** — Endpoints are closed by default; access is explicitly granted

---

## 2. Authentication

### 2.1 Credential Management

- Passwords hashed with **bcrypt** (cost factor: 12)
- Password field never returned from MongoDB (`select: false` on `passwordHash`)
- Minimum password requirements enforced at API validation layer

### 2.2 Session Management

**JWT + httpOnly Cookie approach:**

```
Access Token:
  - Signed with NEXTAUTH_SECRET
  - Expiry: 15 minutes
  - Claims: { sub, role, schoolId, linkedStudentIds?, classIds?, exp, iat }
  - Stored in httpOnly cookie (inaccessible to JavaScript)

Refresh Token:
  - Random UUID, stored as bcrypt hash in users.refreshTokenHash
  - Expiry: 7 days
  - Stored in separate httpOnly, Secure cookie
  - Rotated on every use
  - Invalidated on logout
```

### 2.3 Cookie Security Configuration

```typescript
cookieOptions = {
  httpOnly: true,           // prevents XSS access
  secure: true,             // HTTPS only in production
  sameSite: 'strict',       // prevents CSRF
  path: '/',
  maxAge: 15 * 60           // access token: 15 minutes
}
```

### 2.4 Token Refresh Flow

```
Client detects 401 on API call
  → POST /api/v1/auth/refresh (sends refresh token cookie)
  → Server: verify refresh token hash, check expiry
  → Server: issue new access token + rotate refresh token
  → Client: retries original request
  → On any refresh failure: force logout
```

### 2.5 Logout

```
POST /api/v1/auth/logout
  → Clear both cookies
  → Server: set users.refreshTokenHash = null
  → Ensures refresh token cannot be reused after logout
```

---

## 3. Authorization Architecture

### 3.1 Layers

```
Layer 1: Edge Middleware
  - Verify JWT signature
  - Verify expiry
  - Reject unauthenticated requests before they reach any route

Layer 2: API Route Role Check
  - withRole(['teacher', 'admin']) middleware
  - Rejects requests where user.role is not in permitted set

Layer 3: Service Layer Resource Ownership
  - Verify the specific resource belongs to the user's scope
  - Examples:
      Teacher: studentId must be enrolled in teacher's class
      Parent: studentId must be in parent's linkedStudentIds
      Student: studentId must equal user's own studentId

Layer 4: Database Scoped Query
  - Always include schoolId in queries
  - Always include role-appropriate filters (classId, studentId)
  - Never return records outside user's scope even if IDs are guessed
```

### 3.2 Role-Based Access Control (RBAC)

See `AUTHORIZATION_MATRIX.md` for full resource-level matrix.

```typescript
// Role hierarchy for reference (not inheritance — explicit per endpoint)
enum Role {
  STUDENT = 'student',
  PARENT = 'parent',
  TEACHER = 'teacher',
  COUNSELOR = 'counselor',
  ADMIN = 'admin'
}
```

### 3.3 Sensitive Data Categories

| Category | Sensitivity | Access |
|----------|------------|--------|
| Student PII (name, DOB, address) | High | Role-appropriate portals |
| Academic marks | Medium | Student, Parent, Teacher (own class), Counselor, Admin |
| Mood check-in notes | Very High | Counselor, Admin only |
| Well-being signals | Very High | Counselor, Admin only |
| Risk scores | Very High | Counselor, Admin only |
| Safety reports | Very High | Counselor, Admin only |
| Anonymous report identity | Critical | NEVER exposed |
| AI predictions | High | Teacher (own class), Counselor, Admin |
| Audit logs | High | Admin only |
| GPS location | Medium | Parent (own child's bus), Admin |
| Password hash | Critical | Never returned |
| API keys | Critical | Never returned, never logged |

---

## 4. Anonymous Report Protection

Safety reports submitted as anonymous must have their reporter identity permanently hidden.

```typescript
// SafetyService.createReport()
async createReport(payload: CreateReportPayload, requestingUser: User) {
  const reportData = {
    ...payload,
    // If anonymous, NEVER store or link reporterStudentId
    reporterStudentId: payload.isAnonymous ? null : requestingUser.studentId,
    isAnonymous: payload.isAnonymous
  };
  // Saved to database without reporter reference
}

// API response serializer — safety_reports
// NEVER return reporterStudentId if isAnonymous === true
// This check happens at the serialization layer, not just the query
function serializeSafetyReport(doc: SafetyReport): SafetyReportDTO {
  return {
    ...doc,
    reporterStudentId: doc.isAnonymous ? undefined : doc.reporterStudentId
  };
}
```

---

## 5. Input Validation

All API inputs are validated using **Zod** schemas before reaching the service layer.

```typescript
// Example: Attendance record creation
const createAttendanceSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),  // MongoDB ObjectId
  classId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  date: z.string().datetime(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  remarks: z.string().max(500).optional()
});
```

**Validation rules:**
- All IDs validated as ObjectId format
- Enum fields validated against allowed values
- Text fields have maximum length limits
- Date fields validated as ISO 8601
- File uploads validated by type and size before storage

---

## 6. File Security

- Study materials and attachments are stored in cloud object storage (S3/GCS)
- Files are NOT served directly through Next.js
- Access via signed URLs generated server-side with expiry (15 minutes)
- File upload validates: type (whitelist), size (max 50MB), virus scan (production)
- Filenames are sanitized and replaced with UUID-based names

```typescript
// File access — never expose direct storage URLs
async getStudyMaterialUrl(materialId: string, requestingUser: User): Promise<string> {
  const material = await StudyMaterial.findById(materialId);
  await this.verifyAccess(material, requestingUser);  // role + school check
  return generateSignedUrl(material.fileUrl, { expiresIn: 900 });
}
```

---

## 7. Rate Limiting

Applied to prevent abuse:

| Endpoint Group | Limit |
|----------------|-------|
| `/api/v1/auth/login` | 5 requests/minute per IP |
| `/api/v1/auth/refresh` | 10 requests/minute per user |
| `/api/v1/ai/**` | 20 requests/minute per user |
| `/api/v1/transport/gps` | 60 requests/minute per device |
| General API | 200 requests/minute per user |

Implementation: Next.js middleware + in-memory rate limiter (Redis in production).

---

## 8. Environment Variable Security

```
Rules:
1. All secrets in .env files — NEVER committed to version control
2. .env.example committed with placeholder values only
3. GEMINI_API_KEY, MONGODB_URI, ML_SERVICE_API_KEY — server-side only
4. No NEXT_PUBLIC_ prefix on any secret variable
5. Secrets rotated regularly in production
6. Production secrets managed via cloud secret manager (not .env files)
```

**Forbidden patterns:**
```typescript
// NEVER:
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;  // exposes to browser

// ALWAYS:
// Server-side only (API routes, server components, services)
const apiKey = process.env.GEMINI_API_KEY;
```

---

## 9. Security Headers

Applied via Next.js middleware for all responses:

```typescript
// Security headers
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; ..."
}
```

---

## 10. Audit Logging

Every sensitive action is recorded in `audit_logs`:

**Actions logged:**
- Authentication (login, logout, failed login)
- Any CREATE, UPDATE, DELETE on student data
- Access to risk scores, well-being signals
- Access to safety reports
- AI prediction generation
- Emergency alert creation
- Audit log queries themselves
- File uploads and downloads
- Admin user management operations

**Audit log record is immutable** — no update or delete operations are permitted on `audit_logs` collection. Mongoose model enforces this at the pre-update hook level.

---

## 11. CORS Configuration

```typescript
// CORS — restrict to application origin only
const corsOptions = {
  origin: process.env.NEXTAUTH_URL,  // application URL only
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,  // allow cookies
  optionsSuccessStatus: 200
};
```

ML Service CORS:
- ML service only accepts connections from the Next.js server IP/network
- Not accessible from the public internet

---

## 12. Database Security

- MongoDB Atlas: network access restricted to application server IP(s)
- Dedicated database user with minimum required permissions (read/write on app db only)
- Atlas Audit logging enabled in production
- No direct MongoDB access from frontend or ML service in production
- Connection string never logged

---

## 13. Security Checklist for Each New Feature

Before any feature is implemented, verify:
- [ ] Authentication required on all routes
- [ ] Role check implemented
- [ ] Resource ownership check implemented
- [ ] Input validated with Zod
- [ ] Output serializer strips sensitive fields
- [ ] Sensitive action logged to audit_logs
- [ ] No API keys or secrets in client code
- [ ] No raw database errors returned to client
- [ ] Rate limiting applied where appropriate
- [ ] Anonymous reports handled correctly
