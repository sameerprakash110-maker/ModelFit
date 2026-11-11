# ModelFit — Stage 7: API Integration Guide

**Author:** Ruhaan (Senior Backend Architect & Full-Stack Integration Engineer)  
**Date:** November 11, 2026  
**Repository:** `https://github.com/sameerprakash110-maker/ModelFit`  
**Base URL:** `http://localhost:8000/api/v1` (Default) / Configured via `VITE_API_BASE_URL`

---

## 1. Authentication & Security Headers

All endpoints except `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, and `/health` require a valid JWT Bearer token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_access_token>
```

Unauthenticated requests or requests with expired/invalid tokens receive:
```json
{
  "detail": "Authentication required. Please provide a valid Bearer token."
}
```

---

## 2. Authentication Endpoints

### 2.1 Sign Up (Register New User)
- **Method / Path:** `POST /api/v1/auth/signup`
- **Description:** Registers a new user account with Argon2id password hashing and returns an initial access token.
- **Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123!",
  "full_name": "Jane Doe"
}
```
- **Validation Rules:**
  - `email`: Valid RFC 5322 email string. Automatically stripped and converted to lowercase.
  - `password`: Minimum 8 characters.
  - `full_name`: Optional string.
- **Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@company.com",
    "full_name": "Jane Doe",
    "is_active": true,
    "created_at": "2026-11-11T20:00:00Z",
    "updated_at": "2026-11-11T20:00:00Z"
  }
}
```
- **Error Responses:**
  - `400 Bad Request`: `{"detail": "A user with this email already exists"}`
  - `400 Bad Request`: `{"detail": "Password must be at least 8 characters long"}`

---

### 2.2 Log In
- **Method / Path:** `POST /api/v1/auth/login`
- **Description:** Authenticates user credentials and returns a fresh JWT access token.
- **Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@company.com",
    "full_name": "Jane Doe",
    "is_active": true,
    "created_at": "2026-11-11T20:00:00Z",
    "updated_at": "2026-11-11T20:00:00Z"
  }
}
```
- **Error Responses:**
  - `401 Unauthorized`: `{"detail": "Incorrect email or password"}`
  - `400 Bad Request`: `{"detail": "Inactive user account"}`

---

### 2.3 Get Current User Profile (`/me`)
- **Method / Path:** `GET /api/v1/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@company.com",
  "full_name": "Jane Doe",
  "is_active": true,
  "created_at": "2026-11-11T20:00:00Z",
  "updated_at": "2026-11-11T20:00:00Z"
}
```

---

## 3. Projects API

### 3.1 Create Project
- **Method / Path:** `POST /api/v1/projects`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "name": "Customer Support Triage",
  "description": "Benchmarking LLM routing accuracy for support tickets",
  "system_prompt": "You are a customer support classifier. Output valid JSON.",
  "output_schema": {
    "type": "object",
    "properties": {
      "category": { "type": "string" },
      "urgency": { "type": "string", "enum": ["low", "medium", "high"] }
    },
    "required": ["category", "urgency"]
  },
  "evaluation_criteria": {
    "rubric": "Evaluate accuracy of ticket category and tone appropriateness."
  }
}
```
- **Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "owner_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Customer Support Triage",
  "description": "Benchmarking LLM routing accuracy for support tickets",
  "system_prompt": "You are a customer support classifier. Output valid JSON.",
  "output_schema": { ... },
  "evaluation_criteria": { ... },
  "created_at": "2026-11-11T20:05:00Z",
  "updated_at": "2026-11-11T20:05:00Z"
}
```

### 3.2 List Projects (Tenant-Scoped)
- **Method / Path:** `GET /api/v1/projects`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Returns all projects owned by the currently authenticated user. Projects owned by other users are excluded at the SQL level.
- **Response (200 OK):** Array of Project objects.

### 3.3 Get Project by ID
- **Method / Path:** `GET /api/v1/projects/{project_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Project object.
- **Security Rule:** Returns `404 Not Found` if the project belongs to another tenant.

---

## 4. Test Cases API

### 4.1 Create Test Case
- **Method / Path:** `POST /api/v1/test-cases`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Billing Dispute Test",
  "input_prompt": "I was charged twice for subscription last month. Help!",
  "expected_behavior": "Should assign category 'billing' and urgency 'high'."
}
```
- **Response (201 Created):** TestCase object.

### 4.2 List Test Cases
- **Method / Path:** `GET /api/v1/test-cases?project_id={project_id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Array of TestCase objects.

---

## 5. Benchmarks & Execution API

### 5.1 Create Benchmark
- **Method / Path:** `POST /api/v1/benchmarks`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Q4 Model Comparison",
  "models": [
    "gemini-2.5-flash",
    "llama-3.3-70b-versatile"
  ],
  "repeats": 3
}
```
- **Response (201 Created):**
```json
{
  "id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Q4 Model Comparison",
  "status": "draft",
  "models": ["gemini-2.5-flash", "llama-3.3-70b-versatile"],
  "repeats": 3,
  "is_mock": false,
  "created_at": "2026-11-11T20:10:00Z"
}
```

### 5.2 Execute Benchmark
- **Method / Path:** `POST /api/v1/benchmarks/{benchmark_id}/run`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `use_mock` (boolean, default: `false`): When `true`, runs the benchmark using mock providers without consuming live API credits.
- **Response (200 OK):**
```json
{
  "id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "models": ["gemini-2.5-flash", "llama-3.3-70b-versatile"],
  "repeats": 3,
  "is_mock": false
}
```

### 5.3 Recover Abandoned Benchmark
- **Method / Path:** `POST /api/v1/benchmarks/{benchmark_id}/recover`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Recovers a benchmark that was interrupted by a server shutdown or worker crash.

---

## 6. Reports & ROI API

### 6.1 Benchmark Summary Report
- **Method / Path:** `GET /api/v1/reports/benchmarks/{benchmark_id}/summary`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "benchmark_id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "total_evaluations": 6,
  "models": {
    "gemini-2.5-flash": {
      "mean_score": 0.94,
      "mean_latency_ms": 320.5,
      "p95_latency_ms": 410.2,
      "total_cost": 0.00045,
      "success_rate": 1.0
    },
    "llama-3.3-70b-versatile": {
      "mean_score": 0.91,
      "mean_latency_ms": 185.0,
      "p95_latency_ms": 220.1,
      "total_cost": 0.00012,
      "success_rate": 1.0
    }
  }
}
```

### 6.2 Return on Investment (ROI) & Verdict Report
- **Method / Path:** `GET /api/v1/reports/benchmarks/{benchmark_id}/roi`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `monthly_volume` (integer, default: `100000`): Expected production query volume.
  - `baseline_model` (string, optional): Reference model for savings calculation.
- **Response (200 OK):**
```json
{
  "benchmark_id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "recommended_model": "llama-3.3-70b-versatile",
  "categories": {
    "best_quality": "gemini-2.5-flash",
    "lowest_cost": "llama-3.3-70b-versatile",
    "fastest": "llama-3.3-70b-versatile"
  },
  "projected_savings_monthly": 33.00,
  "cost_per_million_queries": 1.20
}
```

---

## 7. Frontend Integration Code Example

### Setting up an Authenticated Axios Client:
```typescript
import axios from 'axios';
import { getToken, clearSession } from './services/auth';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```
