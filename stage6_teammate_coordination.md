# ModelFit — Stage 6: Teammate Coordination Request

**From:** Ruhaan (Senior Backend Engineer)  
**To:** Ishita (Database Engineer), Ronit (Provider Developer), Frontend Engineering Team  
**Date:** November 11, 2026  
**Subject:** Stage 6 Production Integration Tasks & Required Patch Proposals  

---

## 1. Request for Ishita (Database Ownership)

### Request 1.1: Add `User` SQLAlchemy Model & Non-Destructive Migration
- **Target File:** `backend/app/models/user.py` and `backend/alembic/versions/xxxx_add_users_table.py`
- **Required Schema Change:**
  ```python
  from typing import Optional
  from sqlalchemy import Boolean, String
  from sqlalchemy.orm import Mapped, mapped_column
  from app.core.database import Base
  from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

  class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
      __tablename__ = "users"

      email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
      hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
      full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
      is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="1")
  ```
- **Reason:** Enable persistent database storage for user accounts, replacing the transitional in-process registry.
- **Compatibility:** Fully additive. All column defaults guarantee non-destructive migration.
- **Required Tests:** Unit tests verifying `User` creation, email uniqueness constraint violation handling, and cascade rules.

### Request 1.2: Add `owner_id` Foreign Key to `Project` Model
- **Target File:** `backend/app/models/project.py`
- **Required Schema Change:**
  ```python
  owner_id: Mapped[Optional[str]] = mapped_column(
      String(36),
      ForeignKey("users.id", ondelete="CASCADE"),
      nullable=True,
      index=True,
  )
  ```
- **Reason:** Enforce relational foreign key constraints between users and their owned projects.
- **Compatibility:** `nullable=True` ensures legacy projects created before multi-user authentication remain fully readable without constraint violations.
- **Required Tests:** Test verifying cascade deletion of projects when a user is deleted.

### Request 1.3: Add Persistent `is_mock` Boolean to `Evaluation`, `EvaluationAttempt`, and `Benchmark`
- **Target Files:** `backend/app/models/evaluation.py`, `backend/app/models/evaluation_attempt.py`, `backend/app/models/benchmark.py`
- **Required Schema Change:**
  ```python
  is_mock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
  ```
- **Reason:** Replace application-level string parsing (`response_text.startswith("[MOCK")`) with native SQL-level indexed boolean filtering for live vs mock evaluations.
- **Compatibility:** `server_default="0"` ensures non-destructive migration on existing SQLite and PostgreSQL tables.

---

## 2. Request for Ronit (Provider Ownership)

### Request 2.1: Correct Gemini Token Cost Calculation in `GeminiProvider.generate`
- **Target File:** `backend/app/providers/gemini.py` (Line 153)
- **Current Defect:**
  ```python
  # Line 153 currently hardcodes:
  cost_usd = 0.0
  ```
- **Required Patch:**
  ```python
  from app.services.cost_service import CostService

  # Calculate empirical execution cost based on reported prompt and candidate tokens
  cost_usd = CostService.calculate_cost(
      model=model,
      input_tokens=prompt_tokens,
      output_tokens=candidate_tokens,
  )
  ```
- **Reason:** Live Gemini API calls currently report `$0.00` execution cost, corrupting benchmark financial tracking.
- **Compatibility:** `CostService.calculate_cost` already contains pricing for `gemini-2.5-flash`, `gemini-2.5-pro`, and `gemini-3.1-flash-lite`. Unknown models should return `None` or explicitly track as unpriced.
- **Required Tests:** Test asserting live Gemini generation returns `cost_usd > Decimal("0")`.

### Request 2.2: Groq `openai/` Model Identifier Mapping
- **Status:** Verified and working. Groq models configured with `openai/` identifiers (e.g. `openai/gpt-oss-120b`) correctly resolve to `groq` through `supported_models` registry matching.

---

## 3. Request for Frontend Engineering Team

### Request 3.1: Connect Website Auth Forms to Backend Auth API
- **Target File:** `frontend/src/services/auth.ts`
- **Required Change:** Replace placeholder bodies with calls to `POST /api/v1/auth/signup` and `POST /api/v1/auth/login`. Save the returned `access_token` into `localStorage.setItem('modelfit_access_token', token)`.
- **Reason:** Transition the public website demo auth form into a live authenticated application session.
- **Compatibility:** Fully aligned with the React form states and `RequireAuth.tsx` guard.

### Request 3.2: API Client Authorization Header Interceptor
- **Target File:** API client utility / fetch wrapper
- **Required Change:** Attach `Authorization: Bearer ${localStorage.getItem('modelfit_access_token')}` to all requests to `/projects`, `/benchmarks`, `/test-cases`, and `/reports`.
