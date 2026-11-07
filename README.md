# Get-Hired

AI-powered mock interview platform (Resume Deep Dive, Technical, HR Screening, Mixed modes).

- `frontend/` — React + TypeScript + Vite
- `backend/` — Node.js / Express + PostgreSQL (`pg`)

See `backend/docs/MIGRATION_REFERENCE.md` for the full API contract and domain model.

## Database schema backup

Supabase free-tier projects can be paused/deleted after inactivity. To guard against losing the schema, a **schema-only SQL dump** is kept version-controlled at:

```
backend/database/schema.sql
```

It contains table definitions, indexes, and constraints only — **no row data**, so no user data is ever committed. It is safe to regenerate and commit at any time.
