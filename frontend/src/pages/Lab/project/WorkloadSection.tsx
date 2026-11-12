import { Pencil } from 'lucide-react'
import { Disclosure } from '../../../components/lab/Accordion.tsx'
import type { Project } from '../../../services/api.ts'
import { formatCount, formatDateTime, wordCount } from '../../../utils/format.ts'

const hasKeys = (value: Record<string, unknown> | null) => Boolean(value && Object.keys(value).length > 0)

/** How the workload is set up: what it is, the prompt every model receives, and how answers are judged. */
export function WorkloadSection({ project, onEdit }: { project: Project; onEdit: () => void }) {
  return (
    <div className="acc-body">
      <dl className="kv">
        <div>
          <dt>Description</dt>
          <dd>{project.description ?? <span className="muted">No description yet.</span>}</dd>
        </div>
        <div>
          <dt>Business domain</dt>
          <dd>{project.business_domain ?? <span className="muted">Not set</span>}</dd>
        </div>
        <div>
          <dt>System prompt</dt>
          <dd>
            <pre className="code-block code-block--prose" tabIndex={0} aria-label="System prompt">
              {project.system_prompt}
            </pre>
            <p className="hint">
              {formatCount(wordCount(project.system_prompt))} words. Every model in a benchmark receives this same
              prompt.
            </p>
          </dd>
        </div>
        <div>
          <dt>Evaluation criteria</dt>
          <dd>
            {hasKeys(project.rubric) ? (
              <Disclosure
                title="Custom scoring rubric"
                summary={`${formatCount(Object.keys(project.rubric ?? {}).length)} fields`}
              >
                <pre className="code-block">{JSON.stringify(project.rubric, null, 2)}</pre>
              </Disclosure>
            ) : (
              <span>
                A judge model scores each answer from 0 to 10 against the test case’s expected behaviour.{' '}
                <span className="muted">No custom rubric is set.</span>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Output format</dt>
          <dd>
            {hasKeys(project.output_schema) ? (
              <Disclosure title="Expected output schema" summary="JSON">
                <pre className="code-block">{JSON.stringify(project.output_schema, null, 2)}</pre>
              </Disclosure>
            ) : (
              <span className="muted">Free text. No output schema is set.</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Last changed</dt>
          <dd>{formatDateTime(project.updated_at)}</dd>
        </div>
      </dl>
      <div className="actions">
        <button type="button" className="btn-secondary btn-sm" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Edit configuration
        </button>
      </div>
    </div>
  )
}
