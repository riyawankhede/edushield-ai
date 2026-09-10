# EduShield AI — Demo Mode Documentation

> **Hackathon Demo Role Selector**  
> Allows instant switching between all five user roles without authentication.

---

## Overview

The EduShield AI platform includes a **Demo Role Selector** for hackathon presentations. This allows switching between Admin, Teacher, Parent, Student, and Counselor dashboards instantly without login or authentication.

---

## How It Works

### 1. Visual Location

The demo role selector appears in **the top-right corner of every dashboard page**:

```
┌─────────────────────────────────────────────────────────────┐
│  [EduShield AI Logo]                    [Demo: Student ▾] 🔔 👤 │
│                                         └─ Role Selector       │
└─────────────────────────────────────────────────────────────┘
```

**Path:** Rendered in `src/components/layout/Topbar.tsx`  
**Location:** Top-right area, between search bar and notification bell

### 2. Component Architecture

```
src/components/layout/Topbar.tsx     ← Contains the dropdown UI
       ↓ uses
src/hooks/use-role.ts                ← Zustand state store
       ↓ drives
src/components/layout/Sidebar.tsx    ← Updates nav links based on role
```

**`Topbar.tsx`** — Renders a shadcn `<Select>` dropdown with all five roles. On change, it:
1. Calls `setRole(newRole)` to update Zustand state
2. Calls `router.push(\`/\${newRole}\`)` to navigate immediately

**`use-role.ts`** — A minimal Zustand store:
```typescript
export const useRole = create<RoleState>((set) => ({
  currentRole: "student", // Default role
  setRole: (role) => set({ currentRole: role }),
}))
```

**No persistence** — Role resets to `"student"` on page refresh. This is intentional for demo purposes.

**`Sidebar.tsx`** — Reads `currentRole` from the same Zustand store and renders the appropriate navigation items for that role.

### 3. Available Roles

| Role | Dashboard Route | Default Nav Items |
|------|----------------|-------------------|
| **Admin** | `/admin` | Dashboard, Users, Students, Teachers, Transport, Safety, Emergency |
| **Teacher** | `/teacher` | Dashboard, Students, Attendance, Homework, Reports, Messages |
| **Parent** | `/parent` | Dashboard, Academics, Attendance, Homework, Exams, Bus, Messages |
| **Student** | `/student` | Dashboard, Study Assistant, Study Planner, Study Material, Homework, Bus, Wellbeing |
| **Counselor** | `/counselor` | Dashboard, Cases, Safety Reports, Wellbeing Trends |

### 4. Navigation Behavior

**Selecting a role:**
- **Immediate navigation** — No confirmation dialog
- **State update** — Zustand store updates instantly
- **Sidebar refresh** — Nav links update to match new role
- **Dashboard content** — Loads the correct role's dashboard page

**Direct URL access:**
- Typing `/teacher` in the browser address bar still works
- The role selector will show "Teacher" as selected
- The sidebar will show teacher navigation items

### 5. Visual Styling

The role selector has a **warning-style visual treatment** to indicate it's a demo feature:

```
┌──────────────────────────────┐
│  Demo: [Selected Role ▾]    │  ← Dashed border, yellow/warning color
└──────────────────────────────┘
```

CSS classes: `border-dashed`, `border-warning/50`, `bg-muted/50`

---

## No Authentication Required

**The role selector works without:**
- Login credentials
- JWT cookies
- `getAuthContext()` calls
- `requireAuth()` checks
- Any authentication infrastructure

**Why?** This is a hackathon demo feature. The actual authentication system (JWT, HttpOnly cookies, `requireAuth()`) remains fully intact and is used by all API routes — it's just not used by the dashboard pages in demo mode.

---

## Testing

**Comprehensive test coverage:**

### `src/__tests__/demo-role-selector.test.ts` (18 tests)
- Zustand hook behavior
- All 5 roles are switchable
- State updates correctly
- No authentication required
- Route mapping correctness

### `src/__tests__/topbar-role-selector.test.ts` (7 tests)
- Topbar component integration
- AppShell layout integration
- Dashboard directory structure
- Role-to-route mapping

**Run tests:**
```bash
npm test -- --testPathPattern="demo-role-selector|topbar-role-selector"
```

**All tests:** 571 passing (as of latest run)

---

## Implementation Details

### State Management

**Zustand (not Redux, not Context API):**
- Why? Minimal boilerplate, no providers needed
- Store size: ~10 lines of code
- Performance: Near-zero overhead
- Persistence: None (intentional — resets to "student" on refresh)

### Router Integration

**Next.js 15 App Router:**
```typescript
const router = useRouter()

const handleRoleChange = (role: Role) => {
  setRole(role)            // Update Zustand state
  router.push(\`/\${role}\`)  // Navigate to dashboard
}
```

**Why `router.push` not `<Link>`?**  
The dropdown triggers navigation programmatically. Using `router.push()` ensures immediate navigation on dropdown change.

---

## Limitations (By Design)

1. **No role persistence** — Refresh resets to "student"  
   _Why:_ Demo sessions are temporary. Persistence would require localStorage or cookies, which we're avoiding for simplicity.

2. **No role validation** — Can switch to any role at any time  
   _Why:_ Demo mode. Real auth flow prevents unauthorized role switching.

3. **API routes still require JWT** — The role selector only affects dashboard UI  
   _Why:_ API security must remain intact for production. Demo mode bypasses dashboard auth, not API auth.

---

## Production Considerations

**This is a hackathon demo feature.** For production deployment:

1. **Remove the demo role selector** — Replace with a standard user menu/profile dropdown
2. **Enforce dashboard auth** — Add `getAuthContext()` calls in dashboard pages
3. **Use real user sessions** — Map routes to authenticated user's actual role
4. **Enable role-based routing guards** — Prevent direct URL access to unauthorized dashboards

---

## Related Files

| File | Purpose |
|------|---------|
| `src/components/layout/Topbar.tsx` | Dropdown UI + navigation logic |
| `src/hooks/use-role.ts` | Zustand state store |
| `src/components/layout/Sidebar.tsx` | Role-aware navigation |
| `src/components/layout/AppShell.tsx` | Layout wrapper (Topbar + Sidebar + content) |
| `src/app/(dashboard)/layout.tsx` | Wraps all dashboards in AppShell |
| `src/__tests__/demo-role-selector.test.ts` | Zustand hook tests |
| `src/__tests__/topbar-role-selector.test.ts` | Topbar integration tests |

---

## Questions?

For issues or questions about the demo role selector, check:
1. This documentation (`docs/DEMO_MODE.md`)
2. Test files for usage examples
3. Topbar.tsx source code for implementation details

**Remember:** This is a demo feature. Do not use in production.
