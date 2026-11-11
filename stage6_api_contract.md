# ModelFit — Stage 6: Frontend/Backend API Integration Contract

**Target Audience:** Frontend Engineering Team & Integration Engineers  
**Backend Author:** Ruhaan (Senior Backend Engineer)  
**API Version:** `v1`  
**Base URL:** `http://localhost:8000/api/v1` (configurable via `VITE_API_BASE_URL`)  
**Security Scheme:** HTTP Bearer (JWT)  

---

## 1. Global Request & Authentication Standards

### Common Request Headers
All requests against protected endpoints must include:
```http
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
```

### Standard Error Response Format
All errors return consistent JSON payloads:
```json
{
  "error": {
    "code": "ENTITY_NOT_FOUND | VALIDATION_ERROR | UNAUTHORIZED",
    "message": "Human-readable description of the error",
    "details": {}
  }
}
```
Or standard FastAPI validation errors:
```json
{
  "detail": "Description of the validation or authentication failure"
}
```

---

## 2. Authentication Endpoints

### 2.1 User Registration (`POST /auth/signup`)
Registers a new user and immediately returns a valid JWT access token.

- **Request:**
  ```http
  POST /api/v1/auth/signup
  Content-Type: application/json

  {
    "email": "engineer@company.com",
    "password": "SecurePassword123!",
    "full_name": "Senior AI Engineer"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "e6a12b48-3162-4f3b-b295-8eb6d14068c2",
      "email": "engineer@company.com",
      "full_name": "Senior AI Engineer",
      "is_active": true,
      "created_at": "2026-11-11T12:00:00Z",
      "updated_at": "2026-11-11T12:00:00Z"
    }
  }
  ```

### 2.2 User Login (`POST /auth/login`)
Authenticates an existing user via email and password.

- **Request:**
  ```http
  POST /api/v1/auth/login
  Content-Type: application/json

  {
    "email": "engineer@company.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "e6a12b48-3162-4f3b-b295-8eb6d14068c2",
      "email": "engineer@company.com",
      "full_name": "Senior AI Engineer",
      "is_active": true,
      "created_at": "2026-11-11T12:00:00Z",
      "updated_at": "2026-11-11T12:00:00Z"
    }
  }
  ```

### 2.3 Get Current User (`GET /auth/me`)
Returns the profile of the authenticated user based on the Bearer JWT.

- **Request:**
  ```http
  GET /api/v1/auth/me
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):**
  ```json
  {
    "id": "e6a12b48-3162-4f3b-b295-8eb6d14068c2",
    "email": "engineer@company.com",
    "full_name": "Senior AI Engineer",
    "is_active": true,
    "created_at": "2026-11-11T12:00:00Z",
    "updated_at": "2026-11-11T12:00:00Z"
  }
  ```

---

## 3. Project Management Endpoints

All project endpoints require authentication. Users can only view or manage their own projects.

### 3.1 Create Project (`POST /projects`)
- **Request:**
  ```http
  POST /api/v1/projects
  Authorization: Bearer <jwt_access_token>
  Content-Type: application/json

  {
    "name": "Customer Support Classifier",
    "description": "Benchmark triage classification models",
    "business_domain": "Customer Support",
    "system_prompt": "You are a customer support ticket classification model.",
    "output_schema": {
      "type": "object",
      "properties": {
        "category": {"type": "string"},
        "urgency": {"type": "string"}
      }
    },
    "rubric": {
      "accuracy": 0.6,
      "format_compliance": 0.4
    }
  }
  ```
- **Response (`201 Created`):** Returns the created `ProjectResponse` object.

### 3.2 List Projects (`GET /projects`)
- **Request:**
  ```http
  GET /api/v1/projects?skip=0&limit=50
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):** Returns an array of `ProjectResponse` objects belonging strictly to the calling user.

### 3.3 Get Project by ID (`GET /projects/{project_id}`)
- **Request:**
  ```http
  GET /api/v1/projects/{project_id}
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):** Returns `ProjectResponse`. (Returns `404 Not Found` if the project does not exist or belongs to another user).

---

## 4. Test Case Endpoints

Test cases belong to a parent project. Users can only create or access test cases for projects they own.

### 4.1 Create Test Case (`POST /test-cases`)
- **Request:**
  ```http
  POST /api/v1/test-cases
  Authorization: Bearer <jwt_access_token>
  Content-Type: application/json

  {
    "project_id": "08d02da0-b7f9-4581-a2f4-c519d8ccc484",
    "input_prompt": "My credit card was charged twice for order #1234.",
    "expected_behavior": "Acknowledge billing error and route to Finance.",
    "evaluation_criteria": {
      "must_include": ["refund", "order #1234"],
      "tone": "empathetic"
    }
  }
  ```
- **Response (`201 Created`):** Returns the persisted `TestCaseResponse`.

---

## 5. Benchmark Execution & Recovery Endpoints

### 5.1 Create Benchmark (`POST /benchmarks`)
- **Request:**
  ```http
  POST /api/v1/benchmarks
  Authorization: Bearer <jwt_access_token>
  Content-Type: application/json

  {
    "project_id": "08d02da0-b7f9-4581-a2f4-c519d8ccc484",
    "name": "Gemini vs Groq Support Triage Run",
    "description": "Speed and quality benchmark",
    "selected_models": [
      "gemini-2.5-flash",
      "llama-3.3-70b-versatile"
    ],
    "baseline_model": "gemini-2.5-flash",
    "repeats": 2
  }
  ```
- **Response (`201 Created`):** Returns `BenchmarkResponse` with `status: "pending"`.

### 5.2 Execute Benchmark (`POST /benchmarks/{benchmark_id}/run`)
Orchestrates parallel execution across the model × test case × repeat matrix.

- **Request:**
  ```http
  POST /api/v1/benchmarks/{benchmark_id}/run
  Authorization: Bearer <jwt_access_token>
  Content-Type: application/json

  {
    "mock": false,
    "judge_enabled": true,
    "max_concurrency": 5,
    "judge_provider": "gemini",
    "judge_model": "gemini-3.1-flash-lite"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "benchmark_id": "67fdd4bc-0a61-42a1-b1ec-1e048bc82c4d",
    "status": "completed",
    "total_evaluations": 4,
    "successful_evaluations": 4,
    "failed_evaluations": 0,
    "total_attempts": 4,
    "total_execution_cost": 0.0014,
    "average_latency_ms": 342.15,
    "average_quality_score": 8.75,
    "started_at": "2026-11-11T12:05:00Z",
    "completed_at": "2026-11-11T12:05:04Z"
  }
  ```

### 5.3 Recover Benchmark (`POST /benchmarks/{benchmark_id}/recover`)
Reconciles an abandoned benchmark left in `"running"` status.

- **Request:**
  ```http
  POST /api/v1/benchmarks/{benchmark_id}/recover?force=false&lease_timeout_seconds=300
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):** Returns updated `BenchmarkResponse` with status `"completed"` or `"failed"`. If still active within lease window, returns `HTTP 400 Bad Request`.

---

## 6. Analytics, Reports & ROI Endpoints

### 6.1 Benchmark Detailed Report (`GET /reports/benchmark/{benchmark_id}`)
- **Request:**
  ```http
  GET /api/v1/reports/benchmark/{benchmark_id}?monthly_volume=100000&target_category=best_value&exclude_mock=false
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):** Comprehensive report with model metrics, reliability, token usage, financial aggregates, quality scores, and data-backed ROI model selection.

### 6.2 ROI Recommendation (`GET /reports/roi/{benchmark_id}`)
- **Request:**
  ```http
  GET /api/v1/reports/roi/{benchmark_id}?monthly_volume=250000&target_category=lowest_cost
  Authorization: Bearer <jwt_access_token>
  ```
- **Response (`200 OK`):** Model recommendation with projected monthly savings vs baseline model.

---

## 7. Frontend Integration Snippet (`frontend/src/services/auth.ts`)

To connect the public website auth forms directly to this contract, replace `frontend/src/services/auth.ts` with:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'modelfit_access_token'

export interface Credentials {
  email: string
  password: string
}

export type AuthResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }
  | { status: 'not-connected' }

export async function signUp(credentials: Credentials): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (res.ok) {
      const data = await res.json()
      localStorage.setItem(TOKEN_KEY, data.access_token)
      return { status: 'ok' }
    }

    const err = await res.json()
    return { status: 'error', message: err.detail || 'Sign up failed' }
  } catch (err) {
    return { status: 'error', message: 'Unable to reach account service' }
  }
}

export async function logIn(credentials: Credentials): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (res.ok) {
      const data = await res.json()
      localStorage.setItem(TOKEN_KEY, data.access_token)
      return { status: 'ok' }
    }

    const err = await res.json()
    return { status: 'error', message: err.detail || 'Invalid email or password' }
  } catch (err) {
    return { status: 'error', message: 'Unable to reach account service' }
  }
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function logOut(): void {
  localStorage.removeItem(TOKEN_KEY)
}
```
