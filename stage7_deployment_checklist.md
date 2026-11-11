# ModelFit — Stage 7: Staging & Production Deployment Checklist

**Author:** Ruhaan (Senior Backend Architect & Full-Stack Integration Engineer)  
**Date:** November 11, 2026  
**Repository:** `https://github.com/sameerprakash110-maker/ModelFit`  

---

## 1. Environment & Secrets Configuration

Ensure the target environment has all required secrets configured. **Do NOT run production with default fallback secrets.**

| Environment Variable | Required | Staging / Prod Value Description | Security Note |
| :--- | :---: | :--- | :--- |
| `SECRET_KEY` | **YES** | 64+ character random hex or base64 string (`openssl rand -hex 32`) | Backend startup validator rejects `dev_secret_key_change_in_production_` if `ENVIRONMENT=production`. |
| `ALGORITHM` | NO | `HS256` | Explicitly enforce PyJWT symmetric algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | NO | `1440` (24 hours) or `60` (1 hour for sensitive enterprise setups) | Controls access token validity. |
| `DATABASE_URL` | **YES** | `postgresql://user:pass@host:5432/modelfit` | In production, use PostgreSQL with connection pooling. For staging/local, SQLite is supported. |
| `ENVIRONMENT` | **YES** | `production` or `staging` | Disables debug mode and auto-reloading. |
| `GEMINI_API_KEY` | **YES** | Google AI Studio or Vertex AI Gemini API key | Required for live Gemini benchmarks & LLM-as-a-judge. |
| `GROQ_API_KEY` | **YES** | Groq Cloud production API key | Required for live Groq evaluations. |
| `CORS_ORIGINS` | **YES** | Comma-separated allowed origins (e.g. `https://modelfit.yourdomain.com`) | Restrict strictly to trusted frontend domains. |
| `VITE_API_BASE_URL` | **YES** (Frontend) | URL of backend API Gateway (e.g. `https://api.modelfit.yourdomain.com/api/v1`) | Read by Vite build during static bundling. |

---

## 2. Database Migration Procedure

Always take a snapshot/backup before running migrations in production.

### Step 2.1: Pre-Migration Backup
```bash
# PostgreSQL
pg_dump -h $DB_HOST -U $DB_USER -d modelfit > modelfit_pre_stage7_backup.sql

# SQLite (if staging)
cp modelfit.db modelfit_pre_stage7_backup.db
```

### Step 2.2: Apply Alembic Migrations
```bash
cd backend
python -m alembic upgrade head
```

### Step 2.3: Verify Migration State
```bash
python -m alembic current
# Expected head: f1b2c3d4e5a6 (add_users_table_project_owner_and_attempt_mock_flag)

python -m alembic check
# Expected: "No new upgrade operations detected."
```

### Step 2.4: Emergency Rollback Procedure (If Needed)
```bash
# Downgrade by 1 revision
python -m alembic downgrade -1

# Restore database backup if schema became inconsistent
psql -h $DB_HOST -U $DB_USER -d modelfit < modelfit_pre_stage7_backup.sql
```

---

## 3. Backend Service Deployment

### Step 3.1: Python Environment & Dependencies
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3.2: Production Process Execution (Gunicorn + Uvicorn Workers)
Run behind Gunicorn for multi-process worker supervision:
```bash
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  --timeout 120 \
  --graceful-timeout 30
```

---

## 4. Frontend Web Build & Deployment

### Step 4.1: Install & Build
```bash
cd frontend
npm ci
npm run build
```
Verify output is generated in `frontend/dist/`.

### Step 4.2: Nginx Static Site Configuration
```nginx
server {
    listen 80;
    server_name modelfit.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name modelfit.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/modelfit.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/modelfit.yourdomain.com/privkey.pem;

    root /var/www/modelfit/frontend/dist;
    index index.html;

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
```

---

## 5. Post-Deployment Verification (Smoke Testing)

1. **System Health Check:**
   ```bash
   curl -i https://api.modelfit.yourdomain.com/health
   # Expected: 200 OK {"status": "ok", "app": "ModelFit"}
   ```

2. **Provider Health Verification:**
   ```bash
   curl -i -H "Authorization: Bearer <test_admin_token>" \
     https://api.modelfit.yourdomain.com/api/v1/providers/health
   # Expected: 200 OK with Gemini and Groq statuses ("ok" or "configured")
   ```

3. **User Authentication Flow:**
   - Register a staging user at `https://modelfit.yourdomain.com/signup`.
   - Log out and log in at `https://modelfit.yourdomain.com/login`.
   - Verify JWT is persisted in browser `localStorage`.

4. **Multi-Tenant Isolation Validation:**
   - Create Project A as User A.
   - Attempt to access Project A using User B's token.
   - Ensure the response is `404 Not Found` (never 200 or 403).

5. **Benchmark Execution Smoke Test:**
   - Trigger a fast 1-repeat mock benchmark:
     `POST /api/v1/benchmarks/{id}/run?use_mock=true`
   - Verify benchmark transitions from `draft` -> `running` -> `completed`.
   - Fetch ROI report: `GET /api/v1/reports/benchmarks/{id}/roi`.
