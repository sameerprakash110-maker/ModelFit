# ModelFit — Gemini & Groq Migration Compatibility Report
## Benchmark Orchestration, LLM-as-a-Judge, and Evaluation Integration

> **Author:** Ruhaan (Senior Backend Engineer — Orchestration, Aggregation, ROI, Reporting)  
> **Date:** November 11, 2026  
> **Branch:** `feature/ruhaan-gemini-groq-migration`  
> **Commit Base:** `6be0aa3` (PR #6 merged: Ronit Provider Cleanup)  
> **Test Suite:** **115 / 115 Passed (100%)** | **0 Warnings** | **0 Skipped**  
> **Execution Time:** ~2.04 seconds  

---

## 1. Executive Summary & Root Cause Analysis

Following the cleanup by provider developer Ronit in PR #6, ModelFit officially supports **Google Gemini** and **Groq Cloud** as direct providers. OpenAI was retired as a supported provider.

Prior to this fix, the backend test suite experienced three failures due to obsolete model references and rigid provider error handling:

| Failing Test | Symptom | Root Cause |
|---|---|---|
| `test_run_benchmark_mock_e2e` | Expected 4 evaluations, got 2. | Benchmark fixture defaulted to `["gemini-3.1-flash-lite", "gpt-4o"]`. `gpt-4o` resolved to `openai`, but `get_provider("openai")` was invoked outside the attempt persistence try-catch block. The resulting `ValueError("Unsupported AI provider: openai")` was swallowed by `asyncio.gather(..., return_exceptions=True)`, causing both `gpt-4o` evaluations to be silently dropped without database persistence. |
| `test_judge_unconfigured_provider_fails_gracefully` | Expected `unconfigured_provider` or `provider_error`, got `provider_unavailable`. | Invoking `JudgeService.evaluate` with decommissioned `openai` threw `ValueError: Unsupported AI provider: openai`. `JudgeService` catch-block mapped all `ValueError` exceptions to `provider_unavailable` rather than classifying unknown/unregistered providers as `unsupported_provider` or `provider_error`. |
| `test_benchmark_run_and_reporting_lifecycle` | Expected 2 evaluations, got 1. | Benchmark fixture specified `["gemini-3.1-flash-lite", "gpt-4o"]`. Identical to Failure 1, the `gpt-4o` evaluation was dropped due to unhandled provider lookup exception, leaving only 1 persisted evaluation for `gemini-3.1-flash-lite`. |

---

## 2. Strict Ownership Boundary Compliance

All modifications were strictly confined to **Ruhaan-owned** files. No teammate-owned files were altered.

### Files Modified (Ruhaan's Domain)
1. `backend/app/services/benchmark_service.py`:
   - Removed hardcoded `KNOWN_MODEL_PROVIDERS` catalogue.
   - Refactored `resolve_provider_for_model` to inspect the authoritative provider registry (`app.providers.registry.get_all_providers`).
   - Hardened `_execute_single_evaluation` to guarantee attempt and evaluation persistence across all failure scenarios (unconfigured credentials, network/API errors, and runtime provider instantiation failures).
   - Ensured unsupported models fail validation early and are not silently persisted.
2. `backend/app/services/judge_service.py`:
   - Implemented exact standardized judge error classifications (`unconfigured_provider`, `unsupported_provider`, `provider_unavailable`, `provider_error`, `invalid_judge_response`, `judge_timeout`).
   - Isolated judge failures from candidate evaluations: candidate responses and attempt metrics remain preserved.
3. `backend/tests/test_benchmark_execution.py`:
   - Updated benchmark fixtures to active Gemini/Groq models (`gemini-3.1-flash-lite`, `qwen/qwen3.8-27b`).
   - Added explicit unit tests for Groq models containing `openai/` identifiers (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`).
   - Added tests for early rejection of unsupported models and failed attempt persistence for unconfigured providers.
4. `backend/tests/test_judge_service.py`:
   - Expanded assertions to verify all standardized error types: `unconfigured_provider`, `unsupported_provider`, `judge_timeout`, and `invalid_judge_response`.
5. `backend/tests/test_evaluation_service.py`:
   - Added test `test_historical_openai_records_readability` verifying full queryability of legacy OpenAI records.

### Teammate Files Intact (Verified Untouched)
- `backend/app/providers/` (Ronit) — **Untouched**
- `backend/app/services/cost_service.py` (Ronit) — **Untouched**
- `backend/app/services/provider_service.py` (Ronit) — **Untouched**
- `backend/app/api/v1/endpoints/providers.py` (Ronit) — **Untouched**
- `backend/app/schemas/provider.py` (Ronit) — **Untouched**
- `backend/tests/test_providers.py` (Ronit) — **Untouched**
- `backend/tests/test_provider_abstraction.py` (Ronit) — **Untouched**
- `backend/app/models/` (Ishita) — **Untouched**
- Database migrations (Ishita) — **Untouched**

---

## 3. Authoritative Model-to-Provider Resolution

### Architecture
Per architectural requirements, model resolution was refactored to eliminate the separate `KNOWN_MODEL_PROVIDERS` catalogue and query the authoritative registry directly.

### Key Implementation Details in `BenchmarkService`
```python
@classmethod
def resolve_provider_for_model(cls, model_name: str) -> str:
    """Resolve the appropriate AI provider for a model name using the authoritative registry."""
    normalized = model_name.strip()

    # Query authoritative registered providers
    active_providers = get_all_providers()
    if not active_providers:
        initialize_providers()
        active_providers = get_all_providers()

    for provider_key, provider_inst in active_providers.items():
        if normalized in provider_inst.supported_models:
            return provider_key

    raise ValidationException(
        f"Unable to resolve provider for model '{model_name}'. "
        f"Supported models must be registered in an active provider."
    )
```

### Groq `openai/` Model Prefix Disambiguation
Groq hosts open-weights models with `openai/` in their identifier:
- `openai/gpt-oss-120b`
- `openai/gpt-oss-20b`

Because resolution inspects `provider.supported_models` exactly rather than inferring provider names from prefixes (such as `model.split("/")[0]`), these models resolve directly and accurately to `groq`.

---

## 4. Benchmark Evaluation-Count & Persistence Fix

### Complete Execution Matrix Guarantee
The benchmark orchestrator ensures every combination of $\text{models} \times \text{test cases} \times \text{repeats}$ is executed, tracked, and persisted.

### Distinguishing Unsupported Models from Unconfigured Providers
1. **Unsupported Models (Validation Phase):**  
   If a benchmark run requests an unsupported model (e.g., `gpt-4o` or arbitrary unknown strings), `resolve_provider_for_model` raises `ValidationException` during setup. The benchmark is rejected early with HTTP 400 Bad Request, preventing benchmark status pollution or phantom failed evaluations.
2. **Supported but Unconfigured Providers (Execution Phase):**  
   If a model belongs to a supported provider (Gemini or Groq) but credentials are not configured in live mode (`not provider.is_configured()`), an `EvaluationAttempt` is created with `error_type="unconfigured_provider"`. The evaluation is persisted with `status="failed"`. No evaluations are dropped.
3. **Runtime API / Network Failures (Execution Phase):**  
   Failures during `provider.generate(...)` are retried up to `max_retries`. Each attempt is recorded with `error_type="api_error"` and sanitized error messages. The evaluation is persisted with `status="failed"`.

---

## 5. Standardized LLM-as-a-Judge Error Classification

In `backend/app/services/judge_service.py`, error classification now strictly follows the agreed matrix:

| Scenario | Classification (`error_type`) | Reasoning Narrative |
|---|---|---|
| Supported provider, missing API key | `unconfigured_provider` | `Judge provider '{provider_name}' has no API key configured.` |
| Unknown / unregistered provider | `unsupported_provider` | `Judge provider '{provider_name}' is not supported.` |
| Provider implementation unavailable | `provider_unavailable` | `Judge provider '{provider_name}' implementation is unavailable: {exc}` |
| Provider API execution failure | `provider_error` | `Judge evaluation error: {err_msg}` |
| Invalid judge JSON / structured response | `invalid_judge_response` | `Judge response parsing failed: {val_err}` |
| Evaluation timeout | `judge_timeout` | `Judge evaluation timed out after {timeout}s.` |

### Judge Failure Isolation
When a judge evaluation encounters any of the above errors:
- The candidate model's inference is **never converted to a failure**.
- The candidate response, token usage, latency, and attempts remain intact.
- `quality_score` is set to `None`.
- `judge_reasoning` clearly documents the failure reason.

---

## 6. Historical OpenAI Compatibility

Although new benchmarks cannot select OpenAI models, historical benchmark evaluations conducted prior to the deprecation remain fully readable:
- Persisted records with `provider_name="openai"` and `model_name="gpt-4o"` are verified to load cleanly through:
  - `EvaluationService.get_evaluation_with_attempts`
  - `EvaluationService.get_evaluations_for_benchmark`
- Historical metrics, token counts, and cost values aggregate seamlessly into reports.
- Verified by unit test `test_historical_openai_records_readability`.

---

## 7. Test Verification & Results

### Targeted Tests (Phase 5)
```text
============================= test session starts =============================
collected 35 items

backend/tests/test_benchmark_execution.py ...........                  [ 31%]
backend/tests/test_judge_service.py ............                       [ 65%]
backend/tests/test_reports_api.py .....                                [ 80%]
backend/tests/test_evaluation_service.py .......                       [100%]

============================= 35 passed in 0.64s ==============================
```

### Full Backend Test Suite (Phase 6)
```text
============================= test session starts =============================
platform win32 -- Python 3.14.7, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\ModelFit
configfile: pytest.ini
testpaths: backend/tests
collected 115 items

backend/tests/test_aggregation_service.py ....                         [  3%]
backend/tests/test_benchmark_execution.py ...........                  [ 13%]
backend/tests/test_benchmarks.py .....                                 [ 17%]
backend/tests/test_evaluation_service.py .......                       [ 23%]
backend/tests/test_health.py .                                         [ 24%]
backend/tests/test_judge_service.py ............                       [ 34%]
backend/tests/test_models.py ....................                      [ 52%]
backend/tests/test_projects.py ........                                [ 59%]
backend/tests/test_provider_abstraction.py .....                       [ 63%]
backend/tests/test_provider_health.py .............                    [ 74%]
backend/tests/test_provider_registry.py .....                          [ 79%]
backend/tests/test_providers.py ....                                   [ 82%]
backend/tests/test_reports_api.py .....                                [ 86%]
backend/tests/test_roi_service.py ........                             [ 93%]
backend/tests/test_services.py ..                                      [ 95%]
backend/tests/test_test_cases.py ....                                  [100%]

============================= 115 passed in 2.04s =============================
```

---

## 8. Remaining Coordination Requirements with Ronit

1. **Gemini Live Cost Calculation:**  
   In `backend/app/providers/gemini.py` (line 165), `GeminiProvider.generate` continues to return `cost_usd = 0.0`. Although Ruhaan's `BenchmarkService` protects evaluations by computing costs via `CostService.calculate_cost`, Ronit should update `GeminiProvider` to invoke `CostService` natively for consistency with `GroqProvider`.
2. **Groq Model Additions:**  
   If Groq adds further models (e.g., `llama-3.3-70b-versatile`), they only need to be added to `GroqProvider.supported_models` and `CostService.PRICING_TABLE`. `BenchmarkService` will automatically detect and resolve them without code changes.

---

## 9. Conclusion & Readiness Verdict

All three original test failures have been resolved without weakening assertions or modifying provider-owned code. Dynamic model-to-provider resolution, guaranteed evaluation persistence, and standardized judge error classification are verified.

**Verdict: READY FOR MERGE (ALL 115 TESTS PASSING)**
