import { Check, KeyRound } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ProjectForm } from '../../components/lab/ProjectForm.tsx'
import { RunOptions } from '../../components/lab/RunOptions.tsx'
import { TestCaseForm, TestCaseList } from '../../components/lab/TestCases.tsx'
import { Crumbs, ErrorNote, Loading, Step } from '../../components/lab/ui.tsx'
import { useActionError, useResource } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { Project, Provider, TestCase } from '../../services/api.ts'
import { formatCount } from '../../utils/format.ts'
import { envKeyFor } from '../../utils/providers.ts'

// Mirrors the backend's operational limits (backend/app/core/config.py).
const MAX_MODELS = 10
const MAX_REPEATS = 10
const MAX_CALLS = 500
const SUGGESTED_CASES = 5

type StepNo = 1 | 2 | 3 | 4

/**
 * The guided path to a result: pick a project, add test cases, choose models,
 * then review and run. Each finished step folds into a one-line summary.
 */
export default function NewBenchmark() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const describeError = useActionError()
  const base = useResource(
    () => Promise.all([api.listProjects(), api.listProviders()]).then(([projects, providers]) => ({ projects, providers })),
    [],
  )

  const preselected = params.get('project')
  const [chosenProjectId, setProjectId] = useState<string | null>(preselected)
  const [chosenStep, setStep] = useState<StepNo>(preselected ? 2 : 1)
  const [models, setModels] = useState<string[]>([])
  const [baseline, setBaseline] = useState('')
  const [repeats, setRepeats] = useState(1)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const projects = base.data?.projects ?? []
  const providers = base.data?.providers ?? []
  // A project id (e.g. from the address) that isn't one of yours counts as none chosen: back to step 1.
  const project = projects.find((p) => p.id === chosenProjectId) ?? null
  const projectId = base.data ? (project?.id ?? null) : chosenProjectId
  const step: StepNo = base.data && !project ? 1 : chosenStep

  const cases = useResource<TestCase[]>(
    () => (projectId ? api.listTestCases(projectId) : Promise.resolve([])),
    [projectId],
  )
  const testCases = cases.data ?? []

  if (base.loading && !base.data) return <Loading label="Getting your projects…" />
  if (base.error && !base.data) return <ErrorNote onRetry={base.reload}>{base.error}</ErrorNote>

  const calls = models.length * testCases.length * repeats
  const effectiveBaseline = models.includes(baseline) ? baseline : ''

  const create = async (run: { mock: boolean; judge: boolean } | null) => {
    if (!projectId) return
    setCreating(true)
    setCreateError(null)
    try {
      const benchmark = await api.createBenchmark({
        project_id: projectId,
        name: name.trim() || defaultName(project),
        selected_models: models,
        baseline_model: effectiveBaseline || null,
        repeats,
      })
      navigate(`/app/benchmarks/${benchmark.id}`, { state: run ? { autoRun: run } : null })
    } catch (err) {
      setCreateError(describeError(err))
      setCreating(false)
    }
  }

  const stateOf = (n: StepNo): 'done' | 'current' | 'upcoming' => (n < step ? 'done' : n === step ? 'current' : 'upcoming')

  return (
    <div className="page page--narrow">
      <Crumbs items={[{ label: 'Dashboard', to: '/app' }, { label: 'New benchmark' }]} />
      <header className="page-head">
        <h1 className="page-title">New benchmark</h1>
        <p className="page-lede">
          Four steps: choose a workload, give it real examples, pick the models to compare, then run. Takes a few
          minutes the first time.
        </p>
      </header>

      <div className="wiz">
        <Step
          number={1}
          title="Choose a project"
          state={stateOf(1)}
          onEdit={() => setStep(1)}
          summary={project && <p>{project.name}</p>}
        >
          <ProjectStep
            projects={projects}
            startCreating={params.get('create') === '1'}
            selected={projectId}
            onSelect={(id) => {
              setProjectId(id)
              setStep(2)
            }}
            onCreated={(p) => {
              base.reload()
              setProjectId(p.id)
              setStep(2)
            }}
          />
        </Step>

        <Step
          number={2}
          title="Add test cases"
          state={stateOf(2)}
          onEdit={() => setStep(2)}
          summary={<p>{plural(testCases.length, 'test case')}</p>}
        >
          {projectId && (
            <div className="wiz-stack">
              <p className="wiz-intro">
                Each test case is a real input plus what a good answer does. Every model answers each one.{' '}
                {testCases.length < SUGGESTED_CASES
                  ? `Aim for at least ${SUGGESTED_CASES}; you have ${testCases.length}.`
                  : `You have ${testCases.length}, enough for a steady result.`}
              </p>
              {cases.error && <ErrorNote onRetry={cases.reload}>{cases.error}</ErrorNote>}
              {testCases.length > 0 && (
                <details className="advanced" open={testCases.length <= 3}>
                  <summary>Your {plural(testCases.length, 'test case')}</summary>
                  <TestCaseList testCases={testCases} onChanged={cases.reload} compact />
                </details>
              )}
              <TestCaseForm projectId={projectId} onAdded={cases.reload} />
              <div className="actions actions--wiz">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={testCases.length === 0}
                  onClick={() => setStep(3)}
                >
                  Continue to models
                </button>
                {testCases.length === 0 && <span className="hint">Add at least one test case to continue.</span>}
              </div>
            </div>
          )}
        </Step>

        <Step
          number={3}
          title="Choose models"
          state={stateOf(3)}
          onEdit={() => setStep(3)}
          summary={
            <p>
              {models.join(', ')}
              {effectiveBaseline && <> (using {effectiveBaseline} today)</>}
              {repeats > 1 && <>, {repeats} runs per test case</>}
            </p>
          }
        >
          <ModelStep
            providers={providers}
            models={models}
            setModels={setModels}
            baseline={effectiveBaseline}
            setBaseline={setBaseline}
            repeats={repeats}
            setRepeats={setRepeats}
            name={name}
            setName={setName}
            placeholderName={defaultName(project)}
            caseCount={testCases.length}
            onContinue={() => setStep(4)}
          />
        </Step>

        <Step number={4} title="Review and run" state={stateOf(4)}>
          <div className="wiz-stack">
            <dl className="review">
              <div>
                <dt>Project</dt>
                <dd>{project?.name}</dd>
              </div>
              <div>
                <dt>Test cases</dt>
                <dd>{formatCount(testCases.length)}</dd>
              </div>
              <div>
                <dt>Models</dt>
                <dd>{models.join(', ')}</dd>
              </div>
              <div>
                <dt>Used today</dt>
                <dd>{effectiveBaseline || 'None chosen. The result will name a best fit rather than switch or stay.'}</dd>
              </div>
              <div>
                <dt>Runs per test case</dt>
                <dd>{repeats}</dd>
              </div>
            </dl>
            {createError && <ErrorNote>{createError}</ErrorNote>}
            <RunOptions
              models={models}
              providers={providers}
              calls={calls}
              busy={creating}
              runLabel="Create and run"
              onRun={(options) => create(options)}
              secondary={
                <button type="button" className="btn-text" onClick={() => create(null)} disabled={creating}>
                  Save without running
                </button>
              }
            />
          </div>
        </Step>
      </div>
    </div>
  )
}

function defaultName(project: Project | null) {
  const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date())
  return project ? `${project.name}, ${date}` : `Benchmark, ${date}`
}

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

/* ---------- step 1 ---------- */

function ProjectStep({
  projects,
  startCreating,
  selected,
  onSelect,
  onCreated,
}: {
  projects: Project[]
  startCreating: boolean
  selected: string | null
  onSelect: (id: string) => void
  onCreated: (p: Project) => void
}) {
  const [creating, setCreating] = useState(startCreating || projects.length === 0)

  if (creating || projects.length === 0) {
    return (
      <div className="wiz-stack">
        <p className="wiz-intro">
          A project is one job you use a model for, like answering support tickets or summarising calls.
        </p>
        <ProjectForm
          onCreated={onCreated}
          onCancel={projects.length > 0 ? () => setCreating(false) : undefined}
          submitLabel="Create project and continue"
        />
      </div>
    )
  }

  return (
    <div className="wiz-stack">
      <ul className="pick-list" aria-label="Your projects">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`pick${p.id === selected ? ' is-selected' : ''}`}
              aria-pressed={p.id === selected}
              onClick={() => onSelect(p.id)}
            >
              <span className="pick-name">{p.name}</span>
              {p.business_domain && <span className="pick-sub">{p.business_domain}</span>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-text" onClick={() => setCreating(true)}>
        Create a new project instead
      </button>
    </div>
  )
}

/* ---------- step 3 ---------- */

function ModelStep({
  providers,
  models,
  setModels,
  baseline,
  setBaseline,
  repeats,
  setRepeats,
  name,
  setName,
  placeholderName,
  caseCount,
  onContinue,
}: {
  providers: Provider[]
  models: string[]
  setModels: (fn: (m: string[]) => string[]) => void
  baseline: string
  setBaseline: (v: string) => void
  repeats: number
  setRepeats: (n: number) => void
  name: string
  setName: (v: string) => void
  placeholderName: string
  caseCount: number
  onContinue: () => void
}) {
  const id = useId()
  const [tried, setTried] = useState(false)
  const calls = models.length * caseCount * repeats
  const error = useMemo(() => {
    if (models.length < 2) return 'Pick at least two models, so there is something to compare.'
    if (models.length > MAX_MODELS) return `Pick at most ${MAX_MODELS} models.`
    if (calls > MAX_CALLS)
      return `That is ${formatCount(calls)} model calls; the limit per benchmark is ${MAX_CALLS}. Pick fewer models or fewer runs per test case.`
    return null
  }, [models.length, calls])

  const toggle = (model: string) =>
    setModels((current) => (current.includes(model) ? current.filter((m) => m !== model) : [...current, model]))

  return (
    <div className="wiz-stack">
      <fieldset className="model-picker" aria-describedby={`${id}-help`}>
        <legend>Models to compare</legend>
        <p id={`${id}-help`} className="hint">
          Pick two to four to start: the one you use today plus a cheaper or newer alternative or two.
        </p>
        {providers.map((provider) => (
          <div key={provider.name} className="provider-group">
            <p className="provider-name">
              {provider.display_name}
              {provider.is_configured ? (
                <span className="provider-ok">
                  <Check aria-hidden="true" /> connected
                </span>
              ) : (
                <span className="provider-off">
                  <KeyRound aria-hidden="true" /> simulated only, add <code>{envKeyFor(provider.name)}</code>
                </span>
              )}
            </p>
            <div className="model-chips">
              {provider.supported_models.map((model) => (
                <label key={model} className="model-chip">
                  <input type="checkbox" checked={models.includes(model)} onChange={() => toggle(model)} />
                  <span>
                    <Check aria-hidden="true" className="model-chip-check" />
                    {model}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {models.length > 0 && (
        <fieldset className="baseline-picker">
          <legend>Which of these do you use today?</legend>
          <p className="hint">With one marked, the result tells you whether to switch or stay, and what you would save.</p>
          <div className="radio-row">
            {models.map((m) => (
              <label key={m} className="radio">
                <input type="radio" name={`${id}-baseline`} checked={baseline === m} onChange={() => setBaseline(m)} />
                {m}
              </label>
            ))}
            <label className="radio">
              <input type="radio" name={`${id}-baseline`} checked={baseline === ''} onChange={() => setBaseline('')} />
              None of them yet
            </label>
          </div>
        </fieldset>
      )}

      <details className="advanced">
        <summary>More options</summary>
        <div className="form-row">
          <div className="field field--narrow">
            <label htmlFor={`${id}-repeats`}>Runs per test case</label>
            <input
              id={`${id}-repeats`}
              type="number"
              min={1}
              max={MAX_REPEATS}
              value={repeats}
              onChange={(e) => setRepeats(Math.max(1, Math.min(MAX_REPEATS, Number(e.target.value) || 1)))}
            />
            <p className="hint">
              Models don't give the same answer every time. Two or three runs show how consistent each one is.
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-name`}>Benchmark name</label>
            <input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholderName}
              maxLength={255}
            />
          </div>
        </div>
      </details>

      <p className={`workload${calls > MAX_CALLS ? ' is-over' : ''}`}>
        {models.length} {models.length === 1 ? 'model' : 'models'} × {caseCount}{' '}
        {caseCount === 1 ? 'test case' : 'test cases'} × {repeats} {repeats === 1 ? 'run' : 'runs'} ={' '}
        <strong>{formatCount(calls)} model calls</strong>
      </p>

      {tried && error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions actions--wiz">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setTried(true)
            if (!error) onContinue()
          }}
        >
          Continue to review
        </button>
        <Link to="/app" className="btn-text">
          Cancel
        </Link>
      </div>
    </div>
  )
}
