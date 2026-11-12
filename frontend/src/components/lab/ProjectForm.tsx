import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useActionError } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { Project } from '../../services/api.ts'
import { ErrorNote } from './ui.tsx'

/**
 * Create a project, or edit one when `project` is given: a name and the system
 * prompt the workload uses. Domain and description are optional.
 */
export function ProjectForm({
  project,
  onCreated,
  onSaved,
  onCancel,
  submitLabel,
  promptNote,
}: {
  /** The project to edit. Leave out to create a new one. */
  project?: Project
  onCreated?: (project: Project) => void
  onSaved?: (project: Project) => void
  onCancel?: () => void
  submitLabel?: string
  /** Shown under the system prompt, e.g. how a change affects earlier runs. */
  promptNote?: string
}) {
  const id = useId()
  const describeError = useActionError()
  const editing = Boolean(project)
  const [name, setName] = useState(project?.name ?? '')
  const [systemPrompt, setSystemPrompt] = useState(project?.system_prompt ?? '')
  const [domain, setDomain] = useState(project?.business_domain ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [errors, setErrors] = useState<{ name?: string; systemPrompt?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Give the project a name, such as the feature it powers.'
    if (!systemPrompt.trim()) next.systemPrompt = 'Paste the system prompt your workload uses today.'
    setErrors(next)
    if (next.name || next.systemPrompt) return

    const fields = {
      name: name.trim(),
      system_prompt: systemPrompt.trim(),
      business_domain: domain.trim() || null,
      description: description.trim() || null,
    }
    setSaving(true)
    setSubmitError(null)
    try {
      if (project) onSaved?.(await api.updateProject(project.id, fields))
      else onCreated?.(await api.createProject(fields))
    } catch (err) {
      setSubmitError(describeError(err))
      setSaving(false)
    }
  }

  const optionalFields = (
    <div className="form-row">
      <div className="field">
        <label htmlFor={`${id}-domain`}>Business domain</label>
        <input
          id={`${id}-domain`}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Customer support"
          maxLength={100}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-desc`}>Description</label>
        <input
          id={`${id}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Routes incoming tickets to the right team"
        />
      </div>
    </div>
  )

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Project name</label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support ticket triage"
          maxLength={255}
          data-autofocus
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${id}-name-err` : undefined}
        />
        {errors.name && (
          <p id={`${id}-name-err`} className="field-error">
            {errors.name}
          </p>
        )}
      </div>
      {editing && optionalFields}
      <div className="field">
        <label htmlFor={`${id}-prompt`}>System prompt</label>
        <textarea
          id={`${id}-prompt`}
          rows={editing ? 7 : 4}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a support assistant. Classify each ticket as billing, technical or account, mark it urgent or normal, and reply in two sentences."
          aria-invalid={errors.systemPrompt ? true : undefined}
          aria-describedby={`${id}-prompt-hint`}
        />
        {errors.systemPrompt ? (
          <p id={`${id}-prompt-hint`} className="field-error">
            {errors.systemPrompt}
          </p>
        ) : (
          <p id={`${id}-prompt-hint`} className="hint">
            {promptNote ??
              'The instructions your app sends with every request. Every model in a benchmark gets this same prompt.'}
          </p>
        )}
      </div>
      {!editing && (
        <details className="advanced">
          <summary>Add a domain and description (optional)</summary>
          {optionalFields}
        </details>
      )}
      {submitError && <ErrorNote>{submitError}</ErrorNote>}
      <div className="actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (editing ? 'Saving…' : 'Creating…') : (submitLabel ?? (editing ? 'Save changes' : 'Create project'))}
        </button>
        {onCancel && (
          <button type="button" className="btn-text" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
