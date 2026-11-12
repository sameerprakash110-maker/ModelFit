# ModelFit — Stage 7: Remaining Issues, Operational Considerations & Technical Debt

**Author:** Ruhaan (Senior Backend Architect & Full-Stack Integration Engineer)  
**Date:** November 11, 2026  
**Repository:** `https://github.com/sameerprakash110-maker/ModelFit`  

---

## 1. Overview

While Stage 7 successfully completes full SaaS multi-tenancy, database-backed authentication, Alembic migrations, provider token accuracy, frontend auth integration, and achieves a 100% test pass rate (159/159), this document provides a transparent accounting of operational considerations, architectural trade-offs, and recommended roadmap items for general availability.

---

## 2. Technical Debt & Operational Considerations

### 2.1 Database Concurrency (SQLite to PostgreSQL Transition)
- **Current State:** The default local/test configuration uses SQLite with foreign keys enabled (`PRAGMA foreign_keys = ON`) and Alembic batch alter table migrations.
- **Limitation:** SQLite enforces database-level write locks (`BEGIN IMMEDIATE`). Under high concurrent load (multiple users triggering benchmarks with 5–10 repeats simultaneously across multiple Gunicorn workers), transactions may encounter `sqlite3.OperationalError: database is locked`.
- **Recommendation:** Production deployments must specify a PostgreSQL database URL (`postgresql+psycopg2://...`). All SQLAlchemy 2.0 models, UUID primary keys, and Alembic migrations have been authored to be fully compatible with PostgreSQL.

---

### 2.2 Asynchronous Benchmark Worker Architecture
- **Current State:** Benchmark execution runs within the backend process using FastAPI BackgroundTasks and concurrent Python thread pools (`ThreadPoolExecutor`).
- **Limitation:** If a web worker process is killed by Gunicorn or an OOM killer during a 50-test-case benchmark run, execution halts. ModelFit includes crash recovery logic (`recover_abandoned_benchmarks`), but in-process execution couples API request handling to heavy LLM inference I/O.
- **Recommendation:** For massive enterprise scale, decouple execution into an asynchronous distributed task queue (such as Celery or Temporal) backed by Redis.

---

### 2.3 Stateless JWT Revocation & Refresh Token Pattern
- **Current State:** Authentication uses stateless HS256 JWT tokens with configurable expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Limitation:** Stateless JWTs cannot be revoked server-side prior to expiration without maintaining a token denylist.
- **Recommendation:** For high-security enterprise SaaS:
  1. Implement short-lived access tokens (e.g. 15 minutes).
  2. Implement database-backed or Redis-backed Refresh Tokens stored in HTTP-only, SameSite cookies.
  3. Support instant account revocation on password change or administrative disablement.

---

### 2.4 Application-Level Rate Limiting
- **Current State:** Operational limits are validated per benchmark configuration (e.g. max test cases, max repeats, max model combinations).
- **Limitation:** There is no in-application token bucket rate limiter on `/api/v1/auth/login` or `/api/v1/benchmarks/{id}/run`.
- **Recommendation:** Implement `slowapi` or Redis-backed rate limiting to protect against brute-force password guessing and runaway LLM API consumption.

---

### 2.5 Frontend Workspace UI Integration
- **Current State:**
  - `frontend/src/services/auth.ts` is fully integrated with backend endpoints (`/auth/signup`, `/auth/login`, `/auth/me`).
  - `RequireAuth` guards `/app/*` routes.
  - Sign up, login, error banners, and token storage in `localStorage` are verified and functional.
- **Limitation:**
  - The route `/app/*` currently renders `{null}` within `RequireAuth` because the internal lab workspace components are built as modular sub-packages.
- **Recommendation:** Connect the benchmarking dashboard, prompt editor, and visualization charts (Recharts) into `/app/projects`, `/app/benchmarks`, and `/app/reports`.

---

### 2.6 Email Verification & Password Recovery
- **Current State:** Newly registered users are created with `is_active=True` immediately upon sign up.
- **Limitation:** Users cannot self-recover forgotten passwords without direct database administrative intervention.
- **Recommendation:** Integrate an SMTP/transactional email provider (AWS SES, Resend, or SendGrid) to support email confirmation and time-bound password reset tokens.

---

## 3. Summary of Resolved vs. Remaining Items

| Item | Stage 6 Status | Stage 7 Status | Production Blocker? |
| :--- | :---: | :---: | :---: |
| Database `User` model & persistence | In-Memory Stub | **Database Persisted** | NO |
| `projects.owner_id` relational key | Missing / In-Memory | **Database Persisted & Indexed** | NO |
| `evaluation_attempts.is_mock` flag | Missing | **Database Persisted & Indexed** | NO |
| Multi-user IDOR & access control | Partial | **Enforced (404 Anti-Enumeration)** | NO |
| Gemini thinking-token accounting | Pending Teammate | **Verified Active in CostService** | NO |
| Groq `openai/` model resolution | Pending Fix | **Verified & Tested** | NO |
| Frontend Auth integration | Stubbed (`not-connected`) | **Connected & Verified** | NO |
| PostgreSQL deployment configuration | Documented | Documented & Verified | NO (Configuration only) |
| Celery / Redis task queue | Optional | Optional Roadmap | NO |
| Refresh token rotation | Future | Future Roadmap | NO |
