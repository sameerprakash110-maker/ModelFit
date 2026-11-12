import { FlaskConical, Play, Zap } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { providerForModel } from '../../services/api.ts'
import type { Provider } from '../../services/api.ts'
import { formatCount } from '../../utils/format.ts'
import { envKeyFor } from '../../utils/providers.ts'

/**
 * Choose live or simulated, review the workload, and run. Live is the default
 * when every selected model's provider has a key; otherwise only simulated is offered,
 * with the exact setting that would turn live on.
 */
export function RunOptions({
  models,
  providers,
  calls,
  onRun,
  busy,
  runLabel = 'Run benchmark',
  secondary,
}: {
  models: string[]
  providers: Provider[]
  calls: number
  onRun: (options: { mock: boolean; judge: boolean }) => void
  busy?: boolean
  runLabel?: string
  secondary?: ReactNode
}) {
  const id = useId()
  const missing = useMemo(() => {
    const list = new Map<string, Provider>()
    for (const model of models) {
      const provider = providerForModel(providers, model)
      if (provider && !provider.is_configured) list.set(provider.name, provider)
    }
    return [...list.values()]
  }, [models, providers])
  const liveAllowed = missing.length === 0
  const [mode, setMode] = useState<'live' | 'sim'>(liveAllowed ? 'live' : 'sim')
  const [judge, setJudge] = useState(true)
  const effectiveMode = liveAllowed ? mode : 'sim'

  return (
    <div className="run-options">
      <fieldset className="choice-cards">
        <legend>How should it run?</legend>
        <label className={`choice${!liveAllowed ? ' is-disabled' : ''}`}>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={effectiveMode === 'live'}
            onChange={() => setMode('live')}
            disabled={!liveAllowed}
          />
          <span className="choice-body">
            <span className="choice-title">
              <Zap aria-hidden="true" /> Live
            </span>
            <span className="choice-desc">Calls the real models. Uses your provider credit. Results you can act on.</span>
          </span>
        </label>
        <label className="choice">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={effectiveMode === 'sim'}
            onChange={() => setMode('sim')}
          />
          <span className="choice-body">
            <span className="choice-title">
              <FlaskConical aria-hidden="true" /> Simulated
            </span>
            <span className="choice-desc">No API calls and free. Placeholder answers, for trying the flow.</span>
          </span>
        </label>
      </fieldset>
      {!liveAllowed && (
        <p className="hint">
          Live is off because {missing.map((p) => p.display_name).join(' and ')}{' '}
          {missing.length === 1 ? 'has' : 'have'} no API key. Add{' '}
          {missing.map((p, i) => (
            <span key={p.name}>
              {i > 0 && ' and '}
              <code>{envKeyFor(p.name)}</code>
            </span>
          ))}{' '}
          to <code>backend/.env</code>, restart the backend, then reload this page.
        </p>
      )}

      <details className="advanced">
        <summary>More options</summary>
        <label className="toggle">
          <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
          <span className="toggle-track" aria-hidden="true" />
          <span>
            Score answers with a judge model
            <span className="toggle-hint">
              Recommended. Without it quality isn't measured, and the verdict looks only at cost, speed and
              reliability.
            </span>
          </span>
        </label>
      </details>

      <p className="workload">
        This run makes <strong>{formatCount(calls)} model calls</strong>
        {judge && <>, plus up to {formatCount(calls)} judge calls to score them</>}.{' '}
        {effectiveMode === 'live'
          ? 'Exact spend appears in the results.'
          : 'Simulated runs cost nothing.'}
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || calls === 0}
          onClick={() => onRun({ mock: effectiveMode === 'sim', judge })}
        >
          <Play aria-hidden="true" />
          {busy ? 'Starting…' : effectiveMode === 'sim' ? `${runLabel} (simulated)` : runLabel}
        </button>
        {secondary}
      </div>
    </div>
  )
}
