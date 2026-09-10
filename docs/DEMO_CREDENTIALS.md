# EduShield AI — Demo Credentials

> **Development / hackathon use only.**  
> These accounts are created by `npm run seed` against the demo database.  
> Never use these credentials in a production environment.

---

## Demo Password (all accounts)

```
Password123!
```

All seeded user accounts share this single demo password.

---

## Account Roster

### Admin
| Email | Role |
|-------|------|
| `admin@edushield.org` | admin |

### Teachers
Emails follow the pattern found in `data/seed/teachers.csv`  
(e.g. `priya.sharma@edushield.org`, `rahul.verma@edushield.org`, …)

### Students
Emails follow the pattern:
```
<studentId-lowercase>@students.edushield.org
```
Example: `stu-001@students.edushield.org`

### Parents
Emails follow the pattern:
```
parent.<studentId-lowercase>@edushield.org
```
Example: `parent.stu-001@edushield.org`

---

## Role → Dashboard mapping

| Role | Dashboard URL |
|------|--------------|
| admin | `/admin` |
| teacher | `/teacher` |
| parent | `/parent` |
| student | `/student` |
| counselor | `/counselor` |

---

## How to re-seed

```bash
npm run seed
```

The seed script will:
1. Drop all existing collections
2. Generate a fresh `bcrypt` hash for `Password123!` (cost 12)
3. Create all demo accounts with that hash

---

## Security notes

- The demo password hash is generated at seed-time using `hashPassword()` from  
  `src/lib/password.ts` (bcrypt, cost factor 12).
- No secrets (`MONGODB_URI`, `ACCESS_TOKEN_SECRET`, etc.) are stored in this file.
- Do **not** commit `.env.local`.
