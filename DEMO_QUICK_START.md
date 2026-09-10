# Demo Role Selector — Quick Start Guide

## For Presenters 🎤

### How to Use During Demo

1. **Start the app:** `npm run dev`
2. **Navigate to:** `http://localhost:3000`
3. **Look for:** "Demo: [Role ▾]" in the **top-right corner**
4. **Click it** and select any role:
   - Student → `/student`
   - Parent → `/parent`
   - Teacher → `/teacher`
   - Counselor → `/counselor`
   - Admin → `/admin`

**Navigation is instant** — the page updates immediately.

---

## What You'll See

### For Each Role:

**Student Dashboard (`/student`)**
- Study Assistant
- Homework tracker
- Study Material
- Well-being check-ins
- Bus tracking

**Parent Dashboard (`/parent`)**
- Child's attendance
- Academic performance
- Homework status
- Exams and grades
- Bus location
- AI weekly summary

**Teacher Dashboard (`/teacher`)**
- Class overview
- Student management
- Attendance tracking
- Homework assignments
- AI insights on at-risk students
- Reports generation

**Counselor Dashboard (`/counselor`)**
- Well-being cases
- Safety reports
- Risk assessments
- Intervention tracking

**Admin Dashboard (`/admin`)**
- School-wide analytics
- User management (students, teachers, staff)
- Safety monitoring
- Transportation management
- Emergency alerts
- AI-powered insights

---

## Demo Tips

### 1. Show Role Switching
**Say:** "Let me show you the teacher's perspective..."  
**Do:** Click dropdown → select Teacher → page updates instantly

### 2. Highlight No Login Required
**Say:** "Notice how I can switch roles instantly — this is our demo mode for the hackathon. In production, each user would only see their own role."

### 3. Compare Views
**Say:** "Here's what a teacher sees... now let's look at what the admin sees..."  
**Do:** Switch between Teacher and Admin to show different navigation and features

### 4. End on Admin
Admin has the most comprehensive view — best for final impressions.

---

## Troubleshooting

**Problem:** Dropdown not visible  
**Solution:** The selector is in the top-right corner. Scroll to the top of the page or maximize browser window.

**Problem:** Page doesn't update after selecting role  
**Solution:** Refresh the browser and try again. This is a client-side navigation issue.

**Problem:** Can't see navigation items  
**Solution:** The sidebar is hidden on mobile (< 1024px width). Use a larger screen or desktop view.

**Problem:** Role resets to "Student" after refresh  
**Solution:** This is by design. The role selector doesn't persist across page refreshes in demo mode.

---

## Technical Details (For Q&A)

**Q: Does this require authentication?**  
A: No. The demo role selector works entirely client-side using Zustand state management. The real authentication system (JWT, HttpOnly cookies) is still in place for API routes.

**Q: Can users access dashboards they shouldn't?**  
A: In demo mode, yes — that's intentional for hackathon presentations. In production, we'll enforce role-based access control with JWT authentication.

**Q: How does role switching work?**  
A: The Topbar component uses a Zustand store to track the current role. When you select a role, it updates the state and navigates to that role's dashboard. The Sidebar component reads the same state to show role-appropriate navigation links.

**Q: Is this production-ready?**  
A: The underlying authentication infrastructure is production-ready. The demo role selector is specifically for hackathon presentations and would be removed in production deployment.

---

## Remember

- ✅ All 5 roles work
- ✅ Navigation is instant
- ✅ No authentication needed
- ✅ Role resets on refresh (by design)
- ✅ Works on all dashboards

**For detailed documentation, see `docs/DEMO_MODE.md`**
