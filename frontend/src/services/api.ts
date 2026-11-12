/*
  Typed client for the ModelFit backend (/api/v1). Every call goes through
  authFetch, which attaches the session token. Types mirror the backend's
  Pydantic schemas in backend/app/schemas. Money from the backend is in US
  dollars; convert with usdToInr() from utils/format.ts before showing it.
*/
import { authFetch } from './auth.ts'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: string | { msg?: string; loc?: (string | number)[] }[]
      error?: { message?: string }
    }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      const field = body.detail[0].loc?.at(-1)
      const msg = body.detail[0].msg.replace(/^Value error, /, '')
      return field && typeof field === 'string' ? `${field.replace(/_/g, ' ')}: ${msg}` : msg
    }
    if (body.error?.message) return body.error.message
  } catch {
    // not JSON
  }
  if (res.status === 401) return 'Your session has ended. Log in again.'
  if (res.status >= 500) return 'The server hit a problem. Check that the backend is running, then try again.'
  return `Request failed (${res.status}).`
}

/** Fired on window after any successful change (create, run, delete), so lists like the sidebar can refresh. */
export const LAB_DATA_CHANGED = 'modelfit:data-changed'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await authFetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the backend. Check that it is running on port 8000.')
  }
  if (!res.ok) throw new ApiError(res.status, await readError(res))
  if (method !== 'GET') window.dispatchEvent(new Event(LAB_DATA_CHANGED))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
const del = (path: string) => request<void>('DELETE', path)

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/* ---------- types ---------- */

export interface Project {
  id: string
  name: string
  description: string | null
  business_domain: string | null
  system_prompt: string
  output_schema: Record<string, unknown> | null
  rubric: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  name: string
  description?: string | null
  business_domain?: string | null
  system_prompt: string
}

export interface TestCase {
  id: string
  project_id: string
  input_prompt: string
  expected_behavior: string
  evaluation_criteria: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface TestCaseInput {
  project_id: string
  input_prompt: string
  expected_behavior: string
}

export type BenchmarkStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Benchmark {
  id: string
  project_id: string
  name: string
  description: string | null
  selected_models: string[]
  baseline_model: string | null
  repeats: number
  status: BenchmarkStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface BenchmarkInput {
  project_id: string
  name: string
  description?: string | null
  selected_models: string[]
  baseline_model?: string | null
  repeats: number
}

export interface RunOptions {
  mock: boolean
  judge_enabled: boolean
  max_concurrency?: number
}

export interface RunSummary {
  benchmark_id: string
  status: BenchmarkStatus
  total_evaluations: number
  successful_evaluations: number
  failed_evaluations: number
  total_cost_usd: number
  average_latency_ms: number
  average_quality_score: number | null
  is_mock: boolean
  message: string
}

export interface Provider {
  name: string
  display_name: string
  description: string | null
  is_configured: boolean
  is_active: boolean
  supported_models: string[]
  default_model: string | null
}

export interface ModelMetrics {
  model_name: string
  provider_name: string
  sample_count: number
  reliability: {
    total_evaluations: number
    successful_evaluations: number
    failed_evaluations: number
    success_rate: number
    attempt_counts: number
    retry_rate: number
  }
  performance: {
    average_latency: number
    minimum_latency: number
    maximum_latency: number
    p50_latency: number
    p95_latency: number
  }
  token_usage: {
    total_input_tokens: number
    total_output_tokens: number
    average_input_tokens: number
    average_output_tokens: number
  }
  financial: {
    total_execution_cost: number
    average_cost_per_evaluation: number
    cost_per_successful_evaluation: number
  }
  quality: {
    average_judge_score: number | null
    minimum_judge_score: number | null
    maximum_judge_score: number | null
    judge_completion_rate: number
    sample_count: number
  }
}

export type TargetCategory = 'best_value' | 'best_quality' | 'lowest_cost' | 'fastest'

export interface RoiRecommendation {
  category: TargetCategory | 'no_eligible_model'
  recommended_primary_model: string | null
  recommended_fallback_model: string | null
  monthly_volume: number
  estimated_monthly_cost_usd: number
  estimated_premium_cost_usd: number
  estimated_savings_usd: number
  savings_percentage: number
  cost_per_successful_request: number
  rationale: string
  eligible_models: string[]
  ineligible_reasons: Record<string, string>
}

export interface BenchmarkReport {
  benchmark_id: string
  project_id: string
  name: string
  status: BenchmarkStatus
  selected_models: string[]
  baseline_model: string | null
  repeats: number
  completed_at: string | null
  is_mock: boolean
  model_metrics: Record<string, ModelMetrics>
  overall_reliability: ModelMetrics['reliability']
  overall_performance: ModelMetrics['performance']
  overall_financial: ModelMetrics['financial']
  overall_quality: ModelMetrics['quality']
  roi_recommendation: RoiRecommendation | null
}

export interface Evaluation {
  id: string
  benchmark_id: string
  test_case_id: string | null
  model_name: string
  provider_name: string
  input_tokens: number
  output_tokens: number
  execution_cost: string | number
  latency_ms: number
  quality_score: number | null
  response_text: string | null
  status: 'completed' | 'failed'
  attempt_count: number
  repeat_index: number
  judge_reasoning: string | null
  is_mock: boolean
}

export interface EvaluationDetail extends Evaluation {
  attempts: {
    attempt_number: number
    error_type: string | null
    error_message: string | null
  }[]
}

/* ---------- endpoints ---------- */

export const api = {
  listProjects: () => get<Project[]>('/projects?limit=500'),
  getProject: (id: string) => get<Project>(`/projects/${id}`),
  createProject: (input: ProjectInput) => post<Project>('/projects', input),
  deleteProject: (id: string) => del(`/projects/${id}`),

  listTestCases: (projectId?: string) => get<TestCase[]>(`/test-cases${query({ project_id: projectId, limit: 500 })}`),
  createTestCase: (input: TestCaseInput) => post<TestCase>('/test-cases', input),
  deleteTestCase: (id: string) => del(`/test-cases/${id}`),

  listBenchmarks: (projectId?: string) =>
    get<Benchmark[]>(`/benchmarks${query({ project_id: projectId, limit: 500 })}`),
  getBenchmark: (id: string) => get<Benchmark>(`/benchmarks/${id}`),
  createBenchmark: (input: BenchmarkInput) => post<Benchmark>('/benchmarks', input),
  runBenchmark: (id: string, options: RunOptions) => post<RunSummary>(`/benchmarks/${id}/run`, options),
  /** Closes out a run left 'running' after a crash. The backend refuses while the run is still active. */
  recoverBenchmark: (id: string) => post<Benchmark>(`/benchmarks/${id}/recover`),

  getReport: (id: string, monthlyVolume: number, target: TargetCategory) =>
    get<BenchmarkReport>(`/reports/benchmark/${id}${query({ monthly_volume: monthlyVolume, target_category: target })}`),

  listEvaluations: (benchmarkId: string) => get<Evaluation[]>(`/evaluations/benchmark/${benchmarkId}`),
  getEvaluation: (id: string) => get<EvaluationDetail>(`/evaluations/${id}`),

  listProviders: () => get<Provider[]>('/providers'),
}

/** Which provider serves each model, from the provider catalog. */
export function providerForModel(providers: Provider[], model: string): Provider | undefined {
  return providers.find((provider) => provider.supported_models.includes(model))
}
