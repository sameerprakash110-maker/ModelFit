import { ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useActionError } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { TestCase } from '../../services/api.ts'
import { orderTestCases } from '../../utils/benchmark.ts'
import { formatCount, formatDate } from '../../utils/format.ts'
import { EmptyState, ErrorNote } from './ui.tsx'

/** Test cases, oldest first, numbered so the numbers match the results page. Used by the new-benchmark wizard. */
export function TestCaseList({
  testCases,
  onChanged,
  compact = false,
}: {
  testCases: TestCase[]
  onChanged: () => void
  compact?: boolean
}) {
  return (
    <ol className={`tc-list${compact ? ' tc-list--compact' : ''}`}>
      {orderTestCases(testCases).map((tc, index) => (
        <TestCaseRow key={tc.id} testCase={tc} number={index + 1} onDeleted={onChanged} />
      ))}
    </ol>
  )
}

function TestCaseRow({ testCase, number, onDeleted }: { testCase: TestCase; number: number; onDeleted: () => void }) {
  const describeError = useActionError()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteTestCase(testCase.id)
      onDeleted()
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <li className="tc">
      <span className="tc-num" aria-hidden="true">
        {number}
      </span>
      <div className="tc-body">
        <p className="tc-input">
          <span className="visually-hidden">Test case {number}: </span>
          {testCase.input_prompt}
        </p>
        <p className="tc-good">
          <span>A good answer:</span> {testCase.expected_behavior}
        </p>
        {error && <p className="field-error">{error}</p>}
      </div>
      {confirming ? (
        <span className="tc-confirm">
          <button type="button" className="btn-danger btn-sm" onClick={onDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" className="btn-text" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="icon-btn"
          onClick={() => setConfirming(true)}
          aria-label={`Delete test case ${number}`}
          title="Delete test case"
        >
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/**
 * Add a test case (a real input and what a good answer does), or edit one when
 * `testCase` is given.
 */
export function TestCaseForm({
  projectId,
  testCase,
  onAdded,
  onSaved,
  onCancel,
  focusOnMount = false,
}: {
  projectId: string
  testCase?: TestCase
  onAdded?: () => void
  onSaved?: (testCase: TestCase) => void
  onCancel?: () => void
  focusOnMount?: boolean
}) {
  const id = useId()
  const describeError = useActionError()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editing = Boolean(testCase)
  const [input, setInput] = useState(testCase?.input_prompt ?? '')
  const [expected, setExpected] = useState(testCase?.expected_behavior ?? '')
  const [errors, setErrors] = useState<{ input?: string; expected?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus()
  }, [focusOnMount])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!input.trim()) next.input = 'Enter the message the model will receive.'
    if (!expected.trim()) next.expected = 'Describe what a good answer does, so the judge can score it.'
    setErrors(next)
    if (next.input || next.expected) return

    setSaving(true)
    setSubmitError(null)
    try {
      if (testCase) {
        const saved = await api.updateTestCase(testCase.id, {
          input_prompt: input.trim(),
          expected_behavior: expected.trim(),
        })
        onSaved?.(saved)
        return
      }
      await api.createTestCase({ project_id: projectId, input_prompt: input.trim(), expected_behavior: expected.trim() })
      setInput('')
      setExpected('')
      setAdded((n) => n + 1)
      onAdded?.()
      inputRef.current?.focus()
    } catch (err) {
      setSubmitError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form tc-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-input`}>Input</label>
        <textarea
          ref={inputRef}
          id={`${id}-input`}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          readOnly={saving}
          placeholder="My card was charged twice for order #1234. Please help."
          aria-invalid={errors.input ? true : undefined}
          aria-describedby={`${id}-input-hint`}
        />
        {errors.input ? (
          <p id={`${id}-input-hint`} className="field-error">
            {errors.input}
          </p>
        ) : (
          <p id={`${id}-input-hint`} className="hint">
            A real message from your users or logs. Messy, realistic inputs make a better test than tidy ones.
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${id}-expected`}>What a good answer does</label>
        <textarea
          id={`${id}-expected`}
          rows={2}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          readOnly={saving}
          placeholder="Acknowledges the double charge, apologises, and routes the ticket to billing as urgent."
          aria-invalid={errors.expected ? true : undefined}
          aria-describedby={`${id}-expected-hint`}
        />
        {errors.expected ? (
          <p id={`${id}-expected-hint`} className="field-error">
            {errors.expected}
          </p>
        ) : (
          <p id={`${id}-expected-hint`} className="hint">
            Describe the qualities you want, not a word-for-word answer. The judge scores against this.
          </p>
        )}
      </div>
      {editing && (
        <p className="hint">Benchmarks that already ran keep their results. The change applies to future runs.</p>
      )}
      {submitError && <ErrorNote>{submitError}</ErrorNote>}
      <div className="actions">
        <button type="submit" className={editing ? 'btn-primary' : 'btn-secondary'} disabled={saving}>
          {editing ? (saving ? 'Saving…' : 'Save changes') : saving ? 'Adding…' : 'Add test case'}
        </button>
        {onCancel && (
          <button type="button" className="btn-text" onClick={onCancel}>
            {editing ? 'Cancel' : 'Done adding'}
          </button>
        )}
        <span className="sr-status" role="status">
          {added > 0 && !saving ? 'Test case added.' : ''}
        </span>
      </div>
    </form>
  )
}

/* ---------- the project's test case explorer ---------- */

const SEARCH_FROM = 6

/**
 * Every test case as a compact row: the input on one line, details on demand.
 * Search appears once the list is long enough to need it.
 */
export function TestCaseExplorer({
  projectId,
  testCases,
  onChanged,
  notify,
  startAdding = false,
  addRequest = 0,
}: {
  projectId: string
  testCases: TestCase[]
  onChanged: () => void
  notify: (message: string) => void
  startAdding?: boolean
  /** Bump to open the add form from elsewhere on the page. */
  addRequest?: number
}) {
  const id = useId()
  const [adding, setAdding] = useState(startAdding)
  const [seenRequest, setSeenRequest] = useState(addRequest)
  if (addRequest !== seenRequest) {
    setSeenRequest(addRequest)
    setAdding(true)
  }
  const [query, setQuery] = useState('')
  const ordered = useMemo(() => orderTestCases(testCases), [testCases])
  const needle = query.trim().toLowerCase()
  const matches = ordered
    .map((tc, index) => ({ tc, number: index + 1 }))
    .filter(
      ({ tc }) =>
        !needle ||
        tc.input_prompt.toLowerCase().includes(needle) ||
        tc.expected_behavior.toLowerCase().includes(needle),
    )

  return (
    <div className="tcx">
      {(testCases.length > 0 || adding) && (
        <div className="toolbar">
          {testCases.length >= SEARCH_FROM && (
            <div className="search">
              <Search aria-hidden="true" />
              <label htmlFor={`${id}-q`} className="visually-hidden">
                Search test cases
              </label>
              <input
                id={`${id}-q`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search test cases"
              />
            </div>
          )}
          <p className="toolbar-note">
            {needle
              ? `${formatCount(matches.length)} of ${formatCount(testCases.length)} match`
              : testCases.length > 0 && testCases.length < 5
                ? 'Five or more test cases give a steadier result.'
                : 'Every model answers each test case; a judge scores the answers.'}
          </p>
          {!adding && (
            <button type="button" className="btn-secondary btn-sm toolbar-end" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add test case
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="panel">
          <h3 className="panel-title">{testCases.length === 0 ? 'Add your first test case' : 'Add a test case'}</h3>
          <TestCaseForm
            projectId={projectId}
            focusOnMount
            onAdded={onChanged}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {testCases.length === 0 && !adding ? (
        <EmptyState
          title="Your workload is ready."
          action={
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add test case
            </button>
          }
        >
          <p>Add your first test case to begin benchmarking: a real input, and what a good answer does.</p>
        </EmptyState>
      ) : matches.length === 0 && needle ? (
        <EmptyState
          title={`No test cases match “${query.trim()}”`}
          action={
            <button type="button" className="btn-text" onClick={() => setQuery('')}>
              Clear search
            </button>
          }
        />
      ) : (
        testCases.length > 0 && (
          <ol className="entries" aria-label="Test cases">
            {matches.map(({ tc, number }) => (
              <TestCaseItem
                key={tc.id}
                projectId={projectId}
                testCase={tc}
                number={number}
                onChanged={onChanged}
                notify={notify}
              />
            ))}
          </ol>
        )
      )}
    </div>
  )
}

function TestCaseItem({
  projectId,
  testCase,
  number,
  onChanged,
  notify,
}: {
  projectId: string
  testCase: TestCase
  number: number
  onChanged: () => void
  notify: (message: string) => void
}) {
  const id = useId()
  const describeError = useActionError()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const onDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteTestCase(testCase.id)
      notify(`Test case ${number} deleted.`)
      onChanged()
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <li className={`entry${open ? ' is-open' : ''}`}>
      <button
        ref={toggleRef}
        type="button"
        className="entry-toggle"
        aria-expanded={open}
        aria-controls={`${id}-detail`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="entry-num" aria-hidden="true">
          {number}
        </span>
        <span className="entry-main">
          <span className="visually-hidden">Test case {number}: </span>
          <span className="entry-title entry-title--clamp">{testCase.input_prompt}</span>
        </span>
        <ChevronRight aria-hidden="true" className="entry-chevron" />
      </button>

      <div id={`${id}-detail`} className="entry-detail" hidden={!open}>
        {editing ? (
          <TestCaseForm
            projectId={projectId}
            testCase={testCase}
            focusOnMount
            onSaved={() => {
              setEditing(false)
              notify(`Test case ${number} updated.`)
              onChanged()
              toggleRef.current?.focus()
            }}
            onCancel={() => {
              setEditing(false)
              toggleRef.current?.focus()
            }}
          />
        ) : (
          <>
            <dl className="kv">
              <div>
                <dt>Input prompt</dt>
                <dd className="kv-text">{testCase.input_prompt}</dd>
              </div>
              <div>
                <dt>Expected behaviour</dt>
                <dd className="kv-text">{testCase.expected_behavior}</dd>
              </div>
              <div>
                <dt>Evaluation criteria</dt>
                <dd>
                  {testCase.evaluation_criteria && Object.keys(testCase.evaluation_criteria).length > 0 ? (
                    <pre className="code-block">{JSON.stringify(testCase.evaluation_criteria, null, 2)}</pre>
                  ) : (
                    <span className="muted">The judge scores answers against the expected behaviour above.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatDate(testCase.created_at)}</dd>
              </div>
            </dl>
            {error && <ErrorNote>{error}</ErrorNote>}
            {confirming ? (
              <div className="confirm" role="group" aria-label={`Delete test case ${number}`}>
                <p>
                  Delete test case {number}? Benchmarks that already ran keep their results, but future runs won’t
                  include it.
                </p>
                <div className="actions">
                  <button type="button" className="btn-danger btn-sm" onClick={onDelete} disabled={busy}>
                    <Trash2 aria-hidden="true" />
                    {busy ? 'Deleting…' : 'Delete test case'}
                  </button>
                  <button type="button" className="btn-text" onClick={() => setConfirming(false)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </button>
                <button type="button" className="btn-text btn-text--danger" onClick={() => setConfirming(true)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}
