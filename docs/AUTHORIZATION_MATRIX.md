# Authorization Matrix
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access |
| 🟡 | Scoped access (see condition) |
| ❌ | No access |
| 👁 | Read only |
| ✏️ | Write / Create |
| 🚫 | Explicitly blocked — even if role seems appropriate |

---

## 1. Identity & Profile Data

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Own user profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Other user profiles | ❌ | ❌ | ❌ | ❌ | ✅ |
| Own student profile | ✅ | ❌ | ❌ | ❌ | ✅ |
| Linked child profile | ❌ | 🟡 Linked children only | ❌ | ❌ | ✅ |
| Students in own class | ❌ | ❌ | 🟡 Assigned classes only | ✅ | ✅ |
| All student profiles | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create student | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update student | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deactivate student | ❌ | ❌ | ❌ | ❌ | ✅ |
| Parent-student relationships | ❌ | 👁 Own links | ❌ | ❌ | ✅ |
| Teacher-class assignments | ❌ | ❌ | 👁 Own assignments | ❌ | ✅ |

---

## 2. Academic Data

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Own exam results | ✅ | ❌ | ❌ | ❌ | ❌ |
| Linked child's exam results | ❌ | 🟡 Linked children | ❌ | ❌ | ✅ |
| Class exam results | ❌ | ❌ | 🟡 Assigned classes | 👁 | ✅ |
| Enter/update exam results | ❌ | ❌ | 🟡 Assigned class/subject | ❌ | ✅ |
| Own assignments/homework | ✅ | ❌ | ❌ | ❌ | ❌ |
| Linked child's homework | ❌ | 🟡 Linked children | ❌ | ❌ | ✅ |
| Class assignments | ❌ | ❌ | 🟡 Assigned classes | ❌ | ✅ |
| Create assignment | ❌ | ❌ | 🟡 Own classes | ❌ | ✅ |
| Submit homework | ✅ Own | ❌ | ❌ | ❌ | ❌ |
| Grade submission | ❌ | ❌ | 🟡 Own assignments | ❌ | ✅ |
| Study materials | ✅ Own grade | ❌ | ✅ | ❌ | ✅ |
| Upload study materials | ❌ | ❌ | ✅ | ❌ | ✅ |
| Classes list | 🟡 Enrolled only | 🟡 Child's classes | 🟡 Assigned only | ✅ | ✅ |
| Create class | ❌ | ❌ | ❌ | ❌ | ✅ |
| Subjects list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create subject | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Attendance Data

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Own attendance record | ✅ | ❌ | ❌ | ❌ | ❌ |
| Linked child's attendance | ❌ | 🟡 Linked children | ❌ | ❌ | ✅ |
| Class attendance | ❌ | ❌ | 🟡 Assigned classes | 👁 | ✅ |
| Record attendance | ❌ | ❌ | 🟡 Assigned classes | ❌ | ✅ |
| Correct attendance | ❌ | ❌ | 🟡 Same class, within 24h | ❌ | ✅ |
| Submit leave request | ✅ Own | ✅ Linked child | ❌ | ❌ | ❌ |
| Approve/reject leave | ❌ | ❌ | 🟡 Own class | ❌ | ✅ |
| View all leave requests | ❌ | ❌ | 🟡 Own class | ❌ | ✅ |

---

## 4. Well-being & Safety Data

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Submit mood check-in | ✅ Own | ❌ | ❌ | ❌ | ❌ |
| Own mood history (scores only) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mood check-in notes (text) | 🚫 Own excluded | ❌ | ❌ | ✅ All | ✅ |
| Mood check-ins (all students) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Well-being signals | ❌ | ❌ | ❌ | ✅ | ✅ |
| Review well-being signals | ❌ | ❌ | ❌ | ✅ | ❌ |
| Submit safety report (anonymous) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit safety report (identified) | ✅ | ❌ | ✅ | ✅ | ✅ |
| View safety reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reporter identity (anonymous) | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Assign/update safety reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Safety incidents | ❌ | ❌ | ✅ Create | ✅ | ✅ |
| Safety hotspots | ❌ | ❌ | ❌ | 👁 | ✅ |

---

## 5. Risk & AI Predictions

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Performance predictions (own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Performance predictions (class) | ❌ | ❌ | 🟡 Assigned classes | ❌ | ✅ |
| Performance predictions (school) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Risk scores | ❌ | ❌ | ❌ | ✅ | 🟡 Aggregate view |
| Risk score + contributing factors | ❌ | ❌ | ❌ | ✅ | ❌ |
| Review/acknowledge risk score | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate new prediction | ❌ | ❌ | 🟡 Own class | ❌ | ✅ |
| Study recommendations (own) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate study recommendations | ✅ Own | ❌ | ❌ | ❌ | ❌ |

---

## 6. AI Generative Features

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| AI Study Assistant | ✅ Own curriculum | ❌ | ❌ | ❌ | ❌ |
| AI Parent Assistant | ❌ | 🟡 Linked child only | ❌ | ❌ | ❌ |
| AI Report Generation | ❌ | ❌ | 🟡 Own class students | ❌ | ✅ |
| AI Notice Generation | ❌ | ❌ | ✅ | ❌ | ✅ |
| AI Translation | ❌ | ❌ | ✅ | ❌ | ✅ |
| AI Weekly Summary (receive) | ❌ | 🟡 Linked child | ❌ | ❌ | ❌ |
| AI Weekly Summary (trigger) | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 7. Transport Data

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Own bus assignment | ✅ | ❌ | ❌ | ❌ | ❌ |
| Linked child's bus assignment | ❌ | 🟡 Linked children | ❌ | ❌ | ✅ |
| Bus current location | ❌ | 🟡 Child's bus only | ❌ | ❌ | ✅ |
| Bus route details | 🟡 Own route | 🟡 Child's route | ❌ | ❌ | ✅ |
| All buses / fleet | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bus anomalies | ❌ | ❌ | ❌ | ❌ | ✅ |
| GPS events (raw) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage bus fleet | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assign students to bus | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 8. Communication

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| View notices (own audience) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create notice | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit/delete own notice | ❌ | ❌ | 🟡 Own | ❌ | ✅ |
| Send message (to teacher) | ✅ | ✅ | - | ✅ | ✅ |
| Send message (to parent) | ❌ | - | ✅ | ✅ | ✅ |
| View own inbox | ✅ | ✅ | ✅ | ✅ | ✅ |
| View notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Emergency alerts (receive) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Emergency alerts (create) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Student SOS (trigger) | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Operations (Admin Domain)

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Visitor records | ❌ | ❌ | ❌ | ❌ | ✅ |
| Gate passes (view own) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Gate passes (create) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Gate passes (approve) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| School analytics | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI risk analytics (school) | ❌ | ❌ | ❌ | ❌ | 🟡 Aggregate only |

---

## 10. Behavior Observations

| Resource | Student | Parent | Teacher | Counselor | Admin |
|----------|---------|--------|---------|-----------|-------|
| Own observations (non-private) | 👁 | ❌ | ❌ | ❌ | ❌ |
| Linked child observations (non-private) | ❌ | 👁 | ❌ | ❌ | ❌ |
| Class observations | ❌ | ❌ | 🟡 Own classes | ✅ | ✅ |
| Private observations | ❌ | ❌ | 🟡 Own (own records) | ✅ | ✅ |
| Create observation | ❌ | ❌ | 🟡 Own classes | ❌ | ❌ |

---

## 11. Scoping Rules (Implementation Reference)

### Student Scope

```typescript
function assertStudentScope(requestingUser: User, targetStudentId: string) {
  if (requestingUser.role === 'student') {
    if (requestingUser.studentId !== targetStudentId) throw ForbiddenError();
  }
}
```

### Parent Scope

```typescript
function assertParentChildScope(requestingUser: User, targetStudentId: string) {
  if (requestingUser.role === 'parent') {
    const linked = await ParentStudentRelationship.findOne({
      parentId: requestingUser.parentId,
      studentId: targetStudentId
    });
    if (!linked) throw ForbiddenError();
  }
}
```

### Teacher Scope

```typescript
function assertTeacherClassScope(requestingUser: User, classId: string, subjectId?: string) {
  if (requestingUser.role === 'teacher') {
    const assigned = await TeacherClassAssignment.findOne({
      teacherId: requestingUser.teacherId,
      classId,
      ...(subjectId ? { subjectId } : {}),
      isActive: true
    });
    if (!assigned) throw ForbiddenError();
  }
}
```

### School Scope (all roles)

```typescript
function assertSchoolScope(requestingUser: User, resourceSchoolId: string) {
  if (requestingUser.schoolId !== resourceSchoolId) throw ForbiddenError();
}
```

---

## 12. Critical Security Notes

1. **Anonymous report protection is absolute** — No role, including admin, can access `reporterStudentId` when `isAnonymous = true`. This is enforced at the serialization layer, not just authorization.

2. **Mood check-in free text (notes field)** is counselor-restricted at the query level. The field uses `select: false` and is only included in queries explicitly scoped to counselors.

3. **Risk scores** are never shown to teachers or parents. Teachers see only a simple flag (e.g., "This student has been flagged for counselor review") without the score, factors, or model output.

4. **Well-being signals** are counselor/admin only. No teacher or parent access.

5. **Audit log reads** are admin-only. Counselors and teachers cannot query audit logs.

6. **Role escalation** is not possible through the API. Role is derived from the JWT, which is signed server-side. Users cannot modify their own role claim.
