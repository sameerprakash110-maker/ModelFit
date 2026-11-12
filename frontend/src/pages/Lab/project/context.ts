/*
  What the project layout hands to its two tabs, and the project's health:
  one plain status that says what state the project is in and what to do next.
  Everything is derived from the project's real test cases and benchmarks.
*/
import { useOutletContext } from 'react-router-dom'
import type { Benchmark, Project, Provider, TestCase } from '../../../services/api.ts'
import { formatCount, formatDate } from '../../../utils/format.ts'

export interface ProjectContext {
  project: Project
  testCases: TestCase[]
  /** Newest first. */
  benchmarks: Benchmark[]
  /** The provider catalog; empty if it could not be loaded. */
  providers: Provider[]
  reload: () => void
  /** Shows a short confirmation after a change. */
  notify: (message: string) => void
  openEdit: () => void
}

export const useProject = () => useOutletContext<ProjectContext>()

/* ---------- links ---------- */

export const projectPath = (id: string) => `/app/projects/${id}`
export const analysisPath = (id: string, open?: string, extra = '') =>
  `/app/projects/${id}/analysis${open ? `?open=${open}${extra}` : ''}`
export const addTestCasePath = (id: string) => analysisPath(id, 'tests', '&add=1')
export const newBenchmarkPath = (id: string) => `/app/new?project=${id}`

/* ---------- health ---------- */

export type HealthKind = 'empty' | 'ready' | 'pending' | 'running' | 'results' | 'failed'

export interface Health {
  kind: HealthKind
  title: string
  detail: string
  action: { label: string; to: string } | null
  secondary: { label: string; to: string } | null
  /** The benchmark the status is about, if any. */
  benchmark: Benchmark | null
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

export function projectHealth(projectId: string, testCases: TestCase[], benchmarks: Benchmark[]): Health {
  const latest = benchmarks[0] ?? null
  const running = benchmarks.find((b) => b.status === 'running') ?? null
  const lastResult = benchmarks.find((b) => b.status === 'completed') ?? null
  const results = (b: Benchmark) => ({ label: 'View results', to: `/app/benchmarks/${b.id}` })

  if (running) {
    return {
      kind: 'running',
      title: 'Benchmark in progress',
      detail: `“${running.name}” is running. This page updates when it finishes.`,
      action: { label: 'Watch progress', to: `/app/benchmarks/${running.id}` },
      secondary: lastResult ? { label: 'Previous results', to: `/app/benchmarks/${lastResult.id}` } : null,
      benchmark: running,
    }
  }
  if (testCases.length === 0 && !lastResult) {
    return {
      kind: 'empty',
      title: 'No test cases yet',
      detail: 'Your workload is ready. Add your first test case to begin benchmarking.',
      action: { label: 'Add test case', to: addTestCasePath(projectId) },
      secondary: null,
      benchmark: null,
    }
  }
  if (latest?.status === 'completed') {
    return {
      kind: 'results',
      title: 'Results available',
      detail: `From “${latest.name}”${latest.completed_at ? `, finished ${formatDate(latest.completed_at)}` : ''}.`,
      action: results(latest),
      secondary: null,
      benchmark: latest,
    }
  }
  if (latest?.status === 'failed') {
    return {
      kind: 'failed',
      title: 'Last run failed',
      detail: `No call in “${latest.name}” succeeded. The usual causes are a missing API key or used-up credit.`,
      action: { label: 'See what went wrong', to: `/app/benchmarks/${latest.id}` },
      secondary: lastResult ? { label: 'Last good results', to: `/app/benchmarks/${lastResult.id}` } : null,
      benchmark: latest,
    }
  }
  if (latest?.status === 'pending') {
    return {
      kind: 'pending',
      title: 'Ready to run',
      detail: `“${latest.name}” is set up with ${plural(latest.selected_models.length, 'model')} but hasn’t run yet.`,
      action: { label: 'Open and run', to: `/app/benchmarks/${latest.id}` },
      secondary: lastResult ? { label: 'Previous results', to: `/app/benchmarks/${lastResult.id}` } : null,
      benchmark: latest,
    }
  }
  return {
    kind: 'ready',
    title: 'Ready to benchmark',
    detail: `${plural(testCases.length, 'test case')} ready. Pick the models to compare and run.`,
    action: { label: 'Run benchmark', to: newBenchmarkPath(projectId) },
    secondary: null,
    benchmark: null,
  }
}

/** Distinct models across completed benchmarks. */
export function modelsEvaluated(benchmarks: Benchmark[]): string[] {
  return [...new Set(benchmarks.filter((b) => b.status === 'completed').flatMap((b) => b.selected_models))]
}

export function newestFirst(benchmarks: Benchmark[]): Benchmark[] {
  return [...benchmarks].sort((a, b) => b.created_at.localeCompare(a.created_at))
}
