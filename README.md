# ModelFit – Enterprise AI Benchmarking & Auto-Tuning Platform

**ModelFit** is an enterprise-grade AI benchmarking and auto-tuning platform designed to help businesses evaluate, compare, and optimize Large Language Model (LLM) performance on real-world enterprise workloads.

ModelFit bridges the gap between generic model leaderboards and domain-specific production requirements by evaluating actual workloads across multiple providers (Google Gemini, OpenAI, Groq), tracking latency, token consumption, execution costs, and qualitative accuracy via LLM-as-a-Judge.

---

## Technology Stack

- **Runtime & Language**: Python 3.11+ (Python 3.14 verified)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous, high-performance web framework)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
- **ORM / Database Layer**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) with modern 2.0 type-annotated Declarative mappings
- **Database**: SQLite (initial zero-config development) with seamless migration compatibility to PostgreSQL
- **Database Migrations**: [Alembic](https://alembic.sqlalchemy.org/)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) and `pydantic-settings`
- **HTTP Client**: [HTTPX](https://www.python-httpx.org/) (Asynchronous HTTP requests)
- **Testing**: [pytest](https://docs.pytest.org/) & `pytest-asyncio` with isolated in-memory SQLite fixtures

---

## Architecture & Project Structure

The codebase adheres to clean architecture principles with strict separation of concerns across presentation, domain models, validation schemas, business services, and external provider abstractions:

```
backend/
├── app/
│   ├── main.py                  # FastAPI application factory, CORS, and lifecycle setup
│   │
│   ├── core/                    # Core configuration, database engine, security & exceptions
│   │   ├── config.py            # Pydantic Settings loaded from .env
│   │   ├── database.py          # SQLAlchemy 2.0 engine, SessionLocal, and get_db dependency
│   │   ├── security.py          # API key masking and credential sanitization helpers
│   │   └── exceptions.py        # Domain exception hierarchy and standardized HTTP error handlers
│   │
│   ├── api/                     # Modular API routing
│   │   ├── router.py            # Top-level API router mounting /api/v1
│   │   └── v1/
│   │       ├── router.py        # API v1 router mounting all resource endpoints
│   │       └── endpoints/
│   │           ├── health.py       # GET /api/v1/health
│   │           ├── projects.py     # CRUD /api/v1/projects
│   │           ├── providers.py    # GET /api/v1/providers
│   │           ├── benchmarks.py   # POST / GET / PATCH /api/v1/benchmarks
│   │           ├── test_cases.py   # CRUD /api/v1/test-cases
│   │           ├── evaluations.py  # POST / GET /api/v1/evaluations
│   │           └── reports.py      # GET /api/v1/reports/roi/{benchmark_id}
│   │
│   ├── models/                  # SQLAlchemy 2.0 declarative database models
│   │   ├── base.py              # Base UUID primary key and timestamp mixins
│   │   ├── project.py           # Project entity
│   │   ├── provider.py          # Provider metadata and capability entity
│   │   ├── benchmark.py         # Benchmark run configuration entity
│   │   ├── test_case.py         # Evaluation workload prompt entity
│   │   └── evaluation.py        # Individual model evaluation and scoring entity
│   │
│   ├── schemas/                 # Pydantic v2 validation models
│   │   ├── project.py           # Project request/response schemas
│   │   ├── provider.py          # Provider status and catalog schemas
│   │   ├── benchmark.py         # Benchmark request/response schemas
│   │   ├── test_case.py         # Test case schemas
│   │   └── evaluation.py        # Evaluation result schemas
│   │
│   ├── services/                # Business logic and future engine extension points
│   │   ├── project_service.py       # Project CRUD service
│   │   ├── provider_service.py      # Provider catalog and credential checks
│   │   ├── benchmark_service.py     # Benchmark configuration and status management
│   │   ├── test_case_service.py     # Test case management
│   │   ├── cost_service.py          # Token pricing and USD cost calculation engine
│   │   ├── evaluation_service.py    # LLM-as-a-Judge scoring pipeline placeholder
│   │   ├── prompt_healer_service.py # Prompt optimization / auto-tuning engine placeholder
│   │   ├── reliability_service.py   # Variance and determinism testing placeholder
│   │   └── roi_service.py           # Quality vs cost Pareto recommendation engine
│   │
│   ├── providers/               # AI Provider Abstraction Layer
│   │   ├── base.py              # Abstract BaseLLMProvider & ProviderResult data class
│   │   ├── gemini.py            # Google Gemini provider implementation
│   │   ├── openai.py            # OpenAI provider implementation
│   │   ├── groq.py              # Groq high-speed LPU inference provider implementation
│   │   └── __init__.py          # Provider factory and dynamic registry
│   │
│   └── utils/
│       ├── logger.py            # Configured structured logger
│       └── helpers.py           # UUID and datetime utility helpers
│
├── tests/                       # Automated test suite
│   ├── conftest.py              # Isolated in-memory SQLite fixture and TestClient setup
│   ├── test_health.py           # Health check API tests
│   ├── test_projects.py         # Project CRUD and error handling tests
│   ├── test_providers.py        # Provider catalog and security sanitization tests
│   ├── test_benchmarks.py       # Benchmark lifecycle tests
│   ├── test_test_cases.py       # Test case CRUD tests
│   ├── test_provider_abstraction.py # Provider factory and mock generate tests
│   └── test_services.py         # Cost calculation and future engine placeholder tests
│
├── alembic/                     # Database migrations
│   ├── env.py                   # Migration environment connected to SQLAlchemy metadata
│   ├── script.py.mako           # Migration script template
│   └── versions/                # Migration revisions
│
├── .env.example                 # Environment variable templates
├── .gitignore                   # Git exclusion rules
├── alembic.ini                  # Alembic migration configuration
├── pytest.ini                   # Pytest runner configuration
├── requirements.txt             # Pinned backend dependencies
└── README.md                    # Project documentation
```

---

## Running Locally

ModelFit runs as two processes, each in its own terminal:

| Part | Folder | Address |
|---|---|---|
| Backend (FastAPI) | `backend/` | http://localhost:8000 (API docs at `/docs`) |
| Frontend (React + Vite) | `frontend/` | http://localhost:5173 |

The frontend dev server forwards every `/api` request to the backend on port 8000, so start the backend first and keep both running.

### Prerequisites

- **Python 3.11+**
- **Node.js 20.19+ or 22.12+** (npm comes with it)

### 1. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

| Shell | Command |
|---|---|
| PowerShell | `.venv\Scripts\Activate.ps1` |
| Command Prompt | `.venv\Scripts\activate.bat` |
| Git Bash | `source .venv/Scripts/activate` |
| macOS / Linux | `source .venv/bin/activate` |

> If PowerShell refuses to run the activation script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then try again.

Install dependencies, create your settings file, set up the database, and start the server:

```bash
pip install -r requirements.txt
cp .env.example .env          # Command Prompt: copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Check it's up: http://localhost:8000/api/v1/health should return `"status": "healthy"`.

> **Run `alembic upgrade head` before the first start.** The server creates any missing tables on startup but doesn't record a migration version, so if it starts first, later migrations fail with "table already exists". See [Troubleshooting](#troubleshooting).

#### Provider API keys (optional)

Add keys to `backend/.env`, then restart the backend:

| Variable | Provider | Get a key |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini | https://aistudio.google.com/apikey |
| `GROQ_API_KEY` | Groq | https://console.groq.com/keys |
| `OPENROUTER_API_KEY` | OpenRouter (Anthropic, OpenAI, DeepSeek, Mistral, xAI models) | https://openrouter.ai/keys |

Without keys, everything still works in **Simulated** mode: benchmarks run end to end with placeholder answers and scores. A provider's key turns on **Live** runs for that provider's models.

`backend/.env` is gitignored. Never commit it or paste keys into code.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, sign up at `/signup`, and you land in the dashboard at `/app`. From there: create a project → add test cases → create a benchmark → **Run benchmark**.

Optional settings go in `frontend/.env`:

| Variable | Default | What it does |
|---|---|---|
| `VITE_USD_TO_INR` | `88` | Exchange rate used to show provider prices (in US$) as rupees |
| `VITE_API_BASE_URL` | `/api/v1` | Where the browser sends API calls. Only needed when the backend is on a different domain, e.g. in production |

To point the dev server at a backend on another port, set `MODELFIT_API_TARGET` when starting it:

```bash
MODELFIT_API_TARGET=http://localhost:8001 npm run dev                 # bash / macOS / Linux
$env:MODELFIT_API_TARGET="http://localhost:8001"; npm run dev         # PowerShell
```

### After pulling new changes

```bash
# backend/ (with the virtual environment active)
pip install -r requirements.txt
alembic upgrade head

# frontend/
npm install
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| The app says it "could not reach the backend" | The backend isn't running on port 8000. Start it (step 1). |
| `alembic upgrade head` fails with "table … already exists" | The server created the tables before migrations ran. For a local database you don't need, stop the backend, delete `backend/modelfit.db` (and any `modelfit.db-wal` / `modelfit.db-shm`), then run `alembic upgrade head` again. This erases local accounts and projects. |
| Server errors mentioning `no such column` | Your database is behind the code. Run `alembic upgrade head`. |
| **Live** mode is greyed out | That provider's API key is missing. Add it to `backend/.env` and restart the backend. |
| A run fails with OpenRouter "HTTP 402 … requires more credits" | Add credit at https://openrouter.ai/settings/credits. |
| `npm run dev` says port 5173 is in use | Another dev server is already running. Vite switches to the next free port (5174, …); use the address it prints. |

---

## Available API Endpoints

### Health Check
- `GET /api/v1/health` – Verifies that the backend is active.

### Projects
- `POST /api/v1/projects` – Create a new benchmarking project.
- `GET /api/v1/projects` – List all projects (supports `skip` & `limit` pagination).
- `GET /api/v1/projects/{project_id}` – Get project details by UUID.
- `PUT /api/v1/projects/{project_id}` – Update project metadata or system prompt.
- `DELETE /api/v1/projects/{project_id}` – Delete a project and cascade-delete benchmarks and test cases.

### AI Providers
- `GET /api/v1/providers` – List all supported AI providers (`gemini`, `groq`, `openrouter`), supported models, and credential configuration status (secrets are never leaked).
- `GET /api/v1/providers/{provider_name}` – Get metadata for a specific provider.

### Benchmarks
- `POST /api/v1/benchmarks` – Create a new benchmark configuration for a project (`pending` status).
- `GET /api/v1/benchmarks` – List benchmarks (optionally filter with `?project_id=<UUID>`).
- `GET /api/v1/benchmarks/{benchmark_id}` – Get benchmark details and current execution status.
- `PATCH /api/v1/benchmarks/{benchmark_id}` – Update benchmark status (`pending`, `running`, `completed`, `failed`).

### Test Cases
- `POST /api/v1/test-cases` – Create a prompt test case / workload for a project.
- `GET /api/v1/test-cases` – List test cases (optionally filter with `?project_id=<UUID>`).
- `GET /api/v1/test-cases/{test_case_id}` – Get test case details.
- `PUT /api/v1/test-cases/{test_case_id}` – Update test case prompt or criteria.
- `DELETE /api/v1/test-cases/{test_case_id}` – Delete a test case.

### Evaluations (Future Extension Points)
- `POST /api/v1/evaluations` – Record an evaluation outcome for a benchmark.
- `GET /api/v1/evaluations/benchmark/{benchmark_id}` – List evaluations for a benchmark.

### Reports & ROI Recommendations
- `GET /api/v1/reports/roi/{benchmark_id}` – Get ROI model recommendations and projected savings.

---

## Running the Automated Test Suite

ModelFit uses pytest with an isolated in-memory SQLite database (`sqlite:///:memory:` with `StaticPool`), ensuring test runs never mutate or pollute development databases. Tests also never call real AI providers: provider keys are blanked for the test run even if `backend/.env` has them.

Run from `backend/` with the virtual environment active:

```bash
pytest -v
```

Frontend checks, from `frontend/`:

```bash
npm run lint     # oxlint
npm run build    # type-check and production build
```

---

## Provider Abstraction Architecture

To keep the benchmarking engine strictly decoupled from individual AI vendor APIs, all models are managed through `BaseLLMProvider` in `app/providers/base.py`:

```python
class BaseLLMProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str: ...

    @property
    @abstractmethod
    def supported_models(self) -> List[str]: ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        mock: bool = False,
        **kwargs: Any,
    ) -> ProviderResult: ...
```

Adding a new provider (e.g. Anthropic, Mistral, Local Ollama) requires only:
1. Subclassing `BaseLLMProvider` in `app/providers/<provider>.py`.
2. Registering the class in `app/providers/__init__.py`.
The benchmark runner and API endpoints remain completely unchanged.

---

## Future Feature Extension Points

The architecture defines clean architectural placeholders for upcoming AI benchmarking capabilities:

1. **LLM-as-a-Judge Service** (`app/services/evaluation_service.py`):
   - Automated qualitative scoring, rubric compliance, and hallucination detection.
2. **Prompt Healer Service** (`app/services/prompt_healer_service.py`):
   - Failure analysis, dynamic prompt mutation, and few-shot calibration.
3. **Cost Engine** (`app/services/cost_service.py`):
   - Detailed per-token cost calculation with live pricing tables.
4. **Reliability Engine** (`app/services/reliability_service.py`):
   - Determinism, consistency variance scoring across temperature sweeps.
5. **ROI Engine** (`app/services/roi_service.py`):
   - Pareto efficiency frontier calculations balancing model cost against quality.
